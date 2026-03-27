"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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
import {
  CustomerPaymentMethod,
  getTenantCustomerPaymentMethods,
  isCustomerPaymentMethodEnabled,
} from "@/lib/payment-methods";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { logServerError } from "@/lib/server-error-log";
import { hasFeature } from "@/core/entitlements/engine";

export async function requestBillWithMethod(
  tableId: string,
  method: Exclude<CustomerPaymentMethod, "PAY_LATER">,
  riskSignals?: ClientRiskSignals | null,
) {
  try {
    if (method !== "CASH" && method !== "CREDIT_CARD" && method !== "IYZICO") {
      return {
        success: false,
        message: "Gecersiz odeme yontemi secildi.",
      };
    }

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

    if (method === "IYZICO") {
      const onlinePaymentEnabled = await hasFeature(tenantId, "ONLINE_PAYMENT_IYZICO");
      if (!onlinePaymentEnabled) {
        return {
          success: false,
          message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
        };
      }
    }

    const requestCtx = await getRequestSecurityContext();
    const fingerprintHash = hashValue(riskSignals?.fingerprint ?? null);

    await assertTableSessionActionAllowed({
      tenantId,
      tableId: sessionTableId,
      action: "REQUEST_BILL_WITH_METHOD",
      config: TABLE_ACTION_COOLDOWNS.REQUEST_BILL_WITH_METHOD,
      fingerprintHash,
      ipOverride: requestCtx.ipRaw,
      sessionScope: session.id,
    });

    const risk = await evaluateAndLogRisk({
      tenantId,
      tableId: sessionTableId,
      tableSessionId: session.id,
      action: "REQUEST_BILL_WITH_METHOD",
      signals: riskSignals,
    });

    const activeMethods = await getTenantCustomerPaymentMethods(tenantId);
    if (!isCustomerPaymentMethodEnabled(method, activeMethods)) {
      return {
        success: false,
        message: "Secilen odeme yontemi bu restoran icin aktif degil.",
      };
    }

    if (risk.decision === "block") {
      return {
        success: false,
        message:
          "Güvenlik kontrolleri nedeniyle odeme istegi geçici olarak engellendi.",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
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
          "Acik bir hesap isteginiz zaten var. Lutfen kisa sure sonra tekrar deneyin.",
        );
      }

      const billingSnapshot = await getTableBillingSnapshot({
        tenantId,
        tableId: sessionTableId,
        prismaClient: tx,
      });
      const totalUnpaid = billingSnapshot.totalUnpaid;

      if (totalUnpaid <= 0) {
        throw new TableSessionError(
          "NO_SESSION",
          "Bu masa icin odenecek bir tutar bulunamadi.",
        );
      }

      const billRequest = await tx.billRequest.create({
        data: {
          tenantId,
          tableId: sessionTableId,
          tableSessionId: session.id,
          status: "PENDING",
        },
      });

      if (method === "CASH" || method === "CREDIT_CARD") {
        return {
          method,
          redirectUrl: null as string | null,
        };
      }

      const gatewayToken = `mock_${crypto.randomUUID().replace(/-/g, "")}`;
      await tx.paymentIntent.create({
        data: {
          tenantId,
          billRequestId: billRequest.id,
          amount: totalUnpaid,
          currency: "TRY",
          gatewayToken,
          gatewayProvider: "IYZICO",
          status: "PENDING",
        },
      });

      return {
        method,
        redirectUrl: `/payment/iyzico/mock?token=${encodeURIComponent(gatewayToken)}`,
      };
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");

    if (risk.decision === "suspicious") {
      opLog({
        tenantId,
        tableId: sessionTableId,
        action: "REQUEST_BILL_WITH_METHOD_SUSPICIOUS",
        result: "ok",
        message: `risk=${risk.score}; reasons=${risk.reasons.join(",")}`,
      });
    }

    if (result.method === "CASH") {
      return {
        success: true,
        message: "Nakit odeme isteginiz alindi.",
      };
    }
    if (result.method === "CREDIT_CARD") {
      return {
        success: true,
        message: "Kredi karti odeme isteginiz alindi.",
      };
    }

    return {
      success: true,
      message: "Iyzico odemesi baslatiliyor.",
      redirectUrl: result.redirectUrl,
    };
  } catch (error) {
    if (error instanceof TableSessionError) {
      return { success: false, message: error.message };
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
    logServerError("request-bill-with-method", error);
    return {
      success: false,
      message: "Odeme islemi baslatilamadi.",
    };
  }
}

