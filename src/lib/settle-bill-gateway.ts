"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { opLog } from "@/lib/op-logger";
import {
  createGatewayPaymentIdempotent,
  resolveGatewayPaymentIdentity,
} from "@/lib/payment-idempotency";

type LockedBillRow = {
  id: number;
  status: string;
  tableId: number;
};

/**
 * Internal: settle bill after gateway (iyzico) callback confirmed payment.
 * Only call from trusted API route after verifying payment with gateway.
 */
export async function completeGatewaySettlement(params: {
  tenantId: number;
  billRequestId: number;
  amount: number;
  gatewayPaymentId: string;
}) {
  const { tenantId, billRequestId, amount, gatewayPaymentId } = params;
  const gatewayIdentityResolution = resolveGatewayPaymentIdentity({
    gatewayProvider: "IYZICO",
    gatewayPaymentId,
  });

  if (!gatewayIdentityResolution.ok || !gatewayIdentityResolution.identity) {
    return {
      success: false,
      message: "Odeme referansi gecersiz.",
    };
  }

  const gatewayIdentity = gatewayIdentityResolution.identity;
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedBillRow[]>`
      SELECT "id", "status", "tableId"
      FROM "BillRequest"
      WHERE "id" = ${billRequestId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      return {
        success: false as const,
        message: "Hesap istegi bulunamadi.",
      };
    }

    const bill = rows[0];

    if (bill.status === "SETTLED") {
      return {
        success: true as const,
        tableId: bill.tableId,
        alreadySettled: true,
        message: "Hesap zaten kapatilmis.",
      };
    }

    if (bill.status === "CANCELED") {
      return {
        success: false as const,
        message: "Iptal edilmis hesap kapatilamaz.",
      };
    }

    const paymentCreateResult = await createGatewayPaymentIdempotent({
      tx,
      tenantId,
      billRequestId: bill.id,
      tableId: bill.tableId,
      amount,
      method: "CREDIT_CARD",
      identity: gatewayIdentity,
    });

    if (paymentCreateResult.status === "conflict") {
      return {
        success: false as const,
        message: "Bu ?deme kaydi baska bir hesap icin zaten islenmis.",
      };
    }

    await tx.billRequest.update({
      where: { id: bill.id },
      data: { status: "SETTLED", settledAt: now },
    });

    return {
      success: true as const,
      tableId: bill.tableId,
      alreadySettled: false,
      message: "Hesap kapatildi.",
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
    actor: { type: "admin", id: "gateway" },
    actionType: "BILL_SETTLED",
    entityType: "BillRequest",
    entityId: String(billRequestId),
    description: `Odeme alindi (iyzico): ${amount} TL`,
  });

  opLog({
    tenantId,
    tableId: result.tableId,
    billRequestId,
    action: "SETTLE_BILL_GATEWAY",
    result: "ok",
  });

  revalidatePath("/waiter");
  revalidatePath("/restaurant");

  return { success: true };
}
