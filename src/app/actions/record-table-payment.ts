"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { opLog } from "@/lib/op-logger";

type PaymentMethodValue =
  | "CASH"
  | "CREDIT_CARD"
  | "SODEXO"
  | "MULTINET"
  | "TICKET"
  | "METROPOL";

/** Hesap isteği olmadan masadan doğrudan ödeme alır (masa kapatılmaz). */
export async function recordTablePayment(options: {
  tableId: number;
  amount: number;
  method: PaymentMethodValue;
  note?: string;
}) {
  const { tableId, amount, method, note } = options;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return { success: false, message: "Geçerli bir tutar giriniz." };
  }

  try {
    const { username, tenantId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurant: { tenantId } },
    });
    if (!table) {
      return { success: false, message: "Masa bulunamadı." };
    }

    await prisma.payment.create({
      data: {
        tenantId,
        tableId,
        billRequestId: null,
        amount,
        method,
        note,
      },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "TABLE_PAYMENT",
      entityType: "Table",
      entityId: String(tableId),
      description: `Masa ${table.tableNo} ödeme: ${amount} TL ${method}`,
    });

    opLog({
      tenantId,
      tableId,
      action: "RECORD_TABLE_PAYMENT",
      result: "ok",
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");

    return { success: true, message: "Ödeme kaydedildi." };
  } catch (error) {
    opLog({
      action: "RECORD_TABLE_PAYMENT",
      result: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    return { success: false, message: "Ödeme kaydedilemedi." };
  }
}
