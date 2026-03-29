import { prisma } from "@/lib/prisma";
import { createStorefrontGuestActor } from "@/core/authz/actors";
import { assertSurfaceGuard, SurfaceGuardError } from "@/core/surfaces/guard";
import {
  requireValidTableSessionForRequest,
  TableSessionError,
} from "@/lib/table-session";
import {
  TABLE_ACTION_COOLDOWNS,
  assertTableSessionActionAllowed,
  RateLimitError,
} from "@/lib/rate-limit";
import type { RateLimitInfo } from "@/lib/rate-limit";
import { ClientRiskSignals } from "@/lib/security/types";
import { hashValue } from "@/lib/security/hash";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { evaluateAndLogRisk } from "@/lib/security/risk-engine";
import { opLog } from "@/lib/op-logger";

export type RequestWaiterResult =
  | { success: true; message: string }
  | {
      success: false;
      message: string;
      rateLimit?: RateLimitInfo;
    };

function rateLimitPayload(error: RateLimitError): RateLimitInfo {
  return {
    code: error.code,
    retryAfterSeconds: error.retryAfterSeconds,
  };
}

/**
 * Shared garson çağırma mantığı (server action + API route).
 */
export async function runRequestWaiter(
  tableId: string,
  riskSignals?: ClientRiskSignals | null,
): Promise<RequestWaiterResult> {
  try {
    const { tableId: sessionTableId, tenantId, session } =
      await requireValidTableSessionForRequest({
        tableIdFromRequest: tableId,
      });

    await assertSurfaceGuard({
      surface: "storefront-public",
      actor: createStorefrontGuestActor(tenantId),
      tenantId,
      operation: "mutation",
      requiredCapability: "REQUEST_WAITER",
      requiredFeature: "WAITER_CALL_LOGS",
    });

    const requestCtx = await getRequestSecurityContext();
    const fingerprintHash = hashValue(riskSignals?.fingerprint ?? null);

    await assertTableSessionActionAllowed({
      tenantId,
      tableId: sessionTableId,
      action: "WAITER_CALL",
      config: TABLE_ACTION_COOLDOWNS.WAITER_CALL,
      fingerprintHash,
      ipOverride: requestCtx.ipRaw,
      sessionScope: session.id,
    });

    const now = new Date();

    const activeSession = await prisma.tableSession.findFirst({
      where: {
        tenantId,
        tableId: sessionTableId,
        isActive: true,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSession) {
      return {
        success: false,
        message:
          "Masa oturumu bulunamadi veya suresi doldu. Lutfen QR kodu tekrar okutun.",
      };
    }

    const table = await prisma.table.findFirst({
      where: {
        id: sessionTableId,
        restaurant: { tenantId },
      },
    });

    if (!table || !table.isActive) {
      return {
        success: false,
        message: "Bu masa su an aktif degil. Lutfen garsona basvurun.",
      };
    }

    const risk = await evaluateAndLogRisk({
      tenantId,
      tableId: sessionTableId,
      tableSessionId: session.id,
      action: "WAITER_CALL",
      signals: riskSignals,
    });

    if (risk.decision === "block") {
      opLog({
        tenantId,
        tableId: sessionTableId,
        action: "WAITER_CALL_BLOCKED",
        result: "error",
        message: `risk=${risk.score}; reasons=${risk.reasons.join(",")}`,
      });
      return {
        success: false,
        message:
          "Güvenlik nedeniyle garson cagirma geçici olarak engellendi. Lutfen biraz sonra tekrar deneyin.",
      };
    }

    const existingOpenCall = await prisma.waiterCall.findFirst({
      where: {
        tenantId,
        tableId: sessionTableId,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    });

    if (existingOpenCall) {
      return {
        success: false,
        message:
          "Garson cagirma isteginiz zaten iletildi. Lutfen kisa sure sonra tekrar deneyin.",
      };
    }

    await prisma.$transaction([
      prisma.waiterCall.create({
        data: {
          tenantId,
          tableId: sessionTableId,
          status: "PENDING",
        },
      }),
      prisma.tableSession.update({
        where: { id: activeSession.id },
        data: { lastWaiterCallAt: now },
      }),
    ]);

    if (risk.decision === "suspicious") {
      opLog({
        tenantId,
        tableId: sessionTableId,
        action: "WAITER_CALL_SUSPICIOUS",
        result: "ok",
        message: `risk=${risk.score}; reasons=${risk.reasons.join(",")}`,
      });
    }

    return {
      success: true,
      message: "Garson cagirma isteginiz iletildi.",
    };
  } catch (error) {
    if (error instanceof TableSessionError) {
      return { success: false, message: error.message };
    }
    if (error instanceof RateLimitError) {
      return {
        success: false,
        message: error.message,
        rateLimit: rateLimitPayload(error),
      };
    }
    if (error instanceof SurfaceGuardError) {
      return {
        success: false,
        message: "Bu tenant icin garson cagirma su anda kullanilamiyor.",
      };
    }
    throw error;
  }
}
