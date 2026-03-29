"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { isOrderAwaitingOnlinePayment } from "@/lib/order-payment-visibility";
import { logServerError } from "@/lib/server-error-log";

export async function setOrderDelivered(orderId: number) {
  try {
    const { username, tenantId, staffId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        table: { restaurant: { tenantId } },
      },
      select: {
        id: true,
        status: true,
        requestedPaymentMethod: true,
        paymentStatus: true,
        paymentProvider: true,
      },
    });

    if (!order) {
      return { success: false, message: "Sipariş bulunamadi." };
    }

    if (order.status !== "COMPLETED") {
      return { success: false, message: "Sadece hazır sipariş teslim edilebilir." };
    }

    if (isOrderAwaitingOnlinePayment(order)) {
      return {
        success: false,
        message: "Online odeme tamamlanmayan sipariş teslim edilemez.",
      };
    }

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: { deliveredAt: now, deliveredByStaffId: staffId ?? undefined },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "ORDER_DELIVERED",
      entityType: "Order",
      entityId: String(orderId),
      description: "Sipariş teslim edildi",
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");
    return { success: true };
  } catch (e) {
    logServerError("set-order-delivered", e);
    return { success: false, message: "Guncellenemedi." };
  }
}

