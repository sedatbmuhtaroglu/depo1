"use server";

import { prisma } from "@/lib/prisma";
import { requireCashierWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";

/** Masadan kart ile ödeme için hesap isteği oluşturur (iyzico akışında kullanılır). */
export async function createBillRequestForTable(tableId: number) {
  try {
    const { tenantId } = await requireCashierWaiterOrManagerSession("billrequest.view");
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz.", billRequestId: null };
    }

    const table = await prisma.table.findFirst({
      where: { id: tableId, restaurant: { tenantId } },
    });
    if (!table) {
      return { success: false, message: "Masa bulunamadı.", billRequestId: null };
    }

    const session = await prisma.tableSession.findFirst({
      where: { tenantId, tableId, isActive: true },
    });

    const bill = await prisma.billRequest.create({
      data: {
        tenantId,
        tableId,
        tableSessionId: session?.id ?? null,
        status: "ACKNOWLEDGED",
      },
    });

    return { success: true, message: "Hesap isteği oluşturuldu.", billRequestId: bill.id };
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : "Hesap isteği oluşturulamadı.",
      billRequestId: null,
    };
  }
}


