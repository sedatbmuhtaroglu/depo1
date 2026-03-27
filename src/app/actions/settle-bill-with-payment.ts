"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCashierWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { opLog } from "@/lib/op-logger";
import {
  createGatewayPaymentIdempotent,
  resolveGatewayPaymentIdentity,
} from "@/lib/payment-idempotency";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

type PaymentMethodValue =
  | "CASH"
  | "CREDIT_CARD"
  | "SODEXO"
  | "MULTINET"
  | "TICKET"
  | "METROPOL";

type LockedBillRow = {
  id: number;
  status: string;
  tableId: number;
  acknowledgedAt: Date | null;
  acknowledgedByStaffId: number | null;
};

export async function settleBillWithPayment(options: {
  billRequestId: number;
  amount: number;
  method: PaymentMethodValue;
  note?: string;
  gatewayProvider?: "IYZICO";
  gatewayPaymentId?: string;
}) {
  const { billRequestId, amount, method, note, gatewayProvider, gatewayPaymentId } = options;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return {
      success: false,
      message: "Gecerli bir tutar giriniz.",
    };
  }

  const gatewayIdentityResolution = resolveGatewayPaymentIdentity({
    gatewayProvider,
    gatewayPaymentId,
  });
  if (!gatewayIdentityResolution.ok) {
    return {
      success: false,
      message: gatewayIdentityResolution.message,
    };
  }

  const gatewayIdentity = gatewayIdentityResolution.identity;

  try {
    const { username, tenantId, staffId } = await requireCashierWaiterOrManagerSession("cash.settle");
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "CASH_OPERATIONS");
    if (!featureGate.ok) {
      return { success: false, message: featureGate.message };
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedBillRow[]>`
        SELECT "id", "status", "tableId", "acknowledgedAt", "acknowledgedByStaffId"
        FROM "BillRequest"
        WHERE "id" = ${billRequestId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      `;

      if (rows.length === 0) {
        return {
          success: false as const,
          message: "Bu hesap istegine erisim yetkiniz yok veya kayit bulunamadi.",
        };
      }

      const bill = rows[0];

      if (bill.status === "SETTLED") {
        return {
          success: true as const,
          alreadySettled: true,
          tableId: bill.tableId,
          message: "Bu hesap istegi zaten kapatilmis.",
        };
      }

      if (bill.status === "CANCELED") {
        return {
          success: false as const,
          message: "Iptal edilmis bir hesap istegini kapatamazsiniz.",
        };
      }

      if (gatewayIdentity) {
        const paymentCreateResult = await createGatewayPaymentIdempotent({
          tx,
          tenantId,
          billRequestId: bill.id,
          tableId: bill.tableId,
          amount,
          method,
          note: note ?? null,
          identity: gatewayIdentity,
        });

        if (paymentCreateResult.status === "conflict") {
          return {
            success: false as const,
            message: "Bu odeme kaydi baska bir hesap icin zaten islenmis.",
          };
        }
      } else {
        await tx.payment.create({
          data: {
            tenantId,
            tableId: bill.tableId,
            billRequestId: bill.id,
            amount,
            method,
            note,
          },
        });
      }

      await tx.billRequest.update({
        where: { id: bill.id },
        data: {
          status: "SETTLED",
          settledAt: now,
          ...(bill.acknowledgedAt == null
            ? {
                acknowledgedAt: now,
                acknowledgedByStaffId: staffId ?? null,
              }
            : {}),
        },
      });

      await tx.table.updateMany({
        where: {
          id: bill.tableId,
        },
        data: {
          isActive: false,
        },
      });

      await tx.tableSession.updateMany({
        where: {
          tenantId,
          tableId: bill.tableId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      return {
        success: true as const,
        alreadySettled: false,
        tableId: bill.tableId,
        message: "Hesap kapatildi ve odeme kaydedildi.",
      };
    });

    if (!result.success) {
      return { success: false, message: result.message };
    }

    if (result.alreadySettled) {
      return { success: true, message: result.message };
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "BILL_SETTLED",
      entityType: "BillRequest",
      entityId: String(billRequestId),
      description: `Odeme alindi: ${amount} ${method}`,
    });

    opLog({
      tenantId,
      tableId: result.tableId,
      billRequestId,
      action: "SETTLE_BILL",
      result: "ok",
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    opLog({
      action: "SETTLE_BILL",
      result: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      message: "Hesap kapatilirken bir hata olustu.",
    };
  }
}


