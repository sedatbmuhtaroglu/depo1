'use server';

import { prisma } from "@/lib/prisma";
import {
  requireValidTableSessionForRequest,
  TableSessionError,
} from "@/lib/table-session";
import {
  TABLE_ACTION_COOLDOWNS,
  assertTableSessionActionAllowed,
  RateLimitError,
} from "@/lib/rate-limit";
import { ClientRiskSignals } from "@/lib/security/types";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { hashValue } from "@/lib/security/hash";
import { evaluateAndLogRisk } from "@/lib/security/risk-engine";
import { opLog } from "@/lib/op-logger";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { logServerError } from "@/lib/server-error-log";
import { hasFeature } from "@/core/entitlements/engine";

export async function requestBill(
  tableId: string,
  riskSignals?: ClientRiskSignals | null,
) {
  try {
    const { tableId: sessionTableId, tenantId, session } =
      await requireValidTableSessionForRequest({
        tableIdFromRequest: tableId,
      });

    const billFeatureEnabled =
      (await hasFeature(tenantId, "BILLING_RECEIPTS")) ||
      (await hasFeature(tenantId, "INVOICING"));
    if (!billFeatureEnabled) {
      return {
        success: false,
        message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      };
    }

    const requestCtx = await getRequestSecurityContext();
    const fingerprintHash = hashValue(riskSignals?.fingerprint ?? null);

    await assertTableSessionActionAllowed({
      tenantId,
      tableId: sessionTableId,
      action: "REQUEST_BILL",
      config: TABLE_ACTION_COOLDOWNS.REQUEST_BILL,
      fingerprintHash,
      ipOverride: requestCtx.ipRaw,
      sessionScope: session.id,
    });

    const risk = await evaluateAndLogRisk({
      tenantId,
      tableId: sessionTableId,
      tableSessionId: session.id,
      action: "REQUEST_BILL",
      signals: riskSignals,
      failureMode: "fail-closed",
    });

    if (risk.decision === "block") {
      opLog({
        tenantId,
        tableId: sessionTableId,
        action: "REQUEST_BILL_BLOCKED",
        result: "error",
        message: `risk=${risk.score}; reasons=${risk.reasons.join(",")}`,
      });
      return {
        success: false,
        message:
          "Güvenlik kontrolleri nedeniyle hesap istegi geçici olarak engellendi.",
      };
    }

    const billingSnapshot = await getTableBillingSnapshot({
      tenantId,
      tableId: sessionTableId,
    });
    if (!billingSnapshot.canRequestBill) {
      return {
        success: false,
        message: "Bu masa icin odenecek bir tutar bulunamadi.",
      };
    }

    await prisma.$transaction(async (tx) => {
      const table = await tx.table.findFirst({
        where: {
          id: sessionTableId,
          isActive: true,
          restaurant: { tenantId },
        },
      });

      if (!table) {
        throw new TableSessionError(
          "NO_SESSION",
          "Bu masa su an aktif degil. Lutfen garsona basvurun.",
        );
      }

      const existingOpenRequest = await tx.billRequest.findFirst({
        where: {
          tenantId,
          tableId: sessionTableId,
          tableSessionId: session.id,
          status: { in: ["PENDING", "ACKNOWLEDGED"] },
        },
      });

      if (existingOpenRequest) {
        throw new TableSessionError(
          "NO_SESSION",
          "Hesap isteginiz zaten iletildi. Lutfen kisa sure sonra tekrar deneyin.",
        );
      }

      await tx.billRequest.create({
        data: {
          tenantId,
          tableId: sessionTableId,
          tableSessionId: session.id,
          status: "PENDING",
        },
      });
    });

    if (risk.decision === "suspicious") {
      opLog({
        tenantId,
        tableId: sessionTableId,
        action: "REQUEST_BILL_SUSPICIOUS",
        result: "ok",
        message: `risk=${risk.score}; reasons=${risk.reasons.join(",")}`,
      });
    }

    return {
      success: true,
      message: "Hesap isteginiz garsona iletildi.",
    };
  } catch (error) {
    if (error instanceof TableSessionError) {
      return {
        success: false,
        message:
          error.message ||
          "Masa oturumu bulunamadi veya suresi doldu. Lutfen QR kodu tekrar okutun.",
      };
    }
    if (error instanceof RateLimitError) {
      return {
        success: false,
        message: error.message,
        rateLimit: {
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        },
      };
    }

    logServerError("request-bill", error);
    return {
      success: false,
      message: "Hesap istegi oluşturulurken bir hata olustu.",
    };
  }
}

