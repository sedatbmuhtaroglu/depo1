"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import {
  TABLE_ACTION_COOLDOWNS,
  assertTableSessionActionAllowed,
  RateLimitError,
} from "@/lib/rate-limit";
import {
  getOrderCancellationMatrix,
  isOrderAwaitingOnlinePayment,
  isOrderPaidViaIyzico,
  resolvePaymentSettledState,
} from "@/lib/order-payment-visibility";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { refundPaidIyzicoOrder } from "@/lib/iyzico-order-refund";
import {
  getOrderRefundRuntimeErrorMessage,
  isOrderRefundRuntimeReady,
} from "@/lib/order-refund-runtime";
import { buildCancellationCustomReason } from "@/lib/order-cancellation-finance";
import { logServerError } from "@/lib/server-error-log";

const REASONS = [
  "CUSTOMER_CHANGED_MIND",
  "OUT_OF_STOCK",
  "WRONG_ITEM",
  "OTHER",
] as const;

type CancelMode = "CANCEL" | "REFUND";

type SelectablePaymentMethod =
  | "IYZICO"
  | "CASH"
  | "CREDIT_CARD"
  | "SODEXO"
  | "MULTINET"
  | "TICKET"
  | "METROPOL"
  | "LATER_PAY";

function normalizeAmount(value: number | null | undefined): number | null {
  if (value == null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

export async function cancelOrderItem(
  orderId: number,
  productId: number,
  quantity: number,
  reason: (typeof REASONS)[number],
  customReason?: string,
  mode?: CancelMode,
  selectedPaymentMethod?: SelectablePaymentMethod,
  refundedAmount?: number,
) {
  try {
    const { username, tenantId, role, staffId } = await requireWaiterOrManagerSession();
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
        tableId: true,
        items: true,
        totalPrice: true,
        status: true,
        deliveredAt: true,
        requestedPaymentMethod: true,
        paymentStatus: true,
        paymentProvider: true,
        paymentReference: true,
        paymentConversationId: true,
      },
    });

    if (!order) {
      return { success: false, message: "Sipariş bulunamadı." };
    }

    if (isOrderAwaitingOnlinePayment(order)) {
      return {
        success: false,
        message: "Online ödeme tamamlanmadan sipariş değişikliği yapılamaz.",
      };
    }

    await assertTableSessionActionAllowed({
      tenantId,
      tableId: order.tableId,
      action: "ORDER_CANCEL",
      config: TABLE_ACTION_COOLDOWNS.ORDER_CANCEL,
      allowPrivilegedBypass: true,
    });

    const billingSnapshot = order.deliveredAt
      ? await getTableBillingSnapshot({
          tenantId,
          tableId: order.tableId,
        })
      : null;
    const paymentSettled = resolvePaymentSettledState({
      paymentStatus: order.paymentStatus,
      deliveredAt: order.deliveredAt,
      totalUnpaid: billingSnapshot?.totalUnpaid ?? null,
      totalPaid: billingSnapshot?.totalPaid ?? null,
      totalFromOrders: billingSnapshot?.totalFromOrders ?? null,
    });

    const matrix = getOrderCancellationMatrix({
      status: order.status,
      deliveredAt: order.deliveredAt,
      paymentStatus: order.paymentStatus,
      paymentSettled,
    });
    const requestedMode: CancelMode = mode ?? (matrix.paid ? "REFUND" : "CANCEL");

    if (!matrix.canCancel && !matrix.canRefund) {
      return {
        success: false,
        message:
          matrix.blockMessage ??
          "SİPARİŞ HAZIRLANIYOR AŞAMASINDA OLDUĞU İÇİN İPTAL VEYA İADE EDİLEMEZ",
      };
    }
    if (requestedMode === "REFUND" && !matrix.canRefund) {
      return {
        success: false,
        message: "Bu sipariş için sadece iptal işlemi yapılabilir.",
      };
    }
    if (requestedMode === "CANCEL" && !matrix.canCancel) {
      return {
        success: false,
        message: "Bu sipariş için sadece iade işlemi yapılabilir.",
      };
    }

    if (
      order.status === "COMPLETED" &&
      order.deliveredAt &&
      role !== "WAITER" &&
      role !== "MANAGER"
    ) {
      return {
        success: false,
        message: "Teslim edilmiş sipariş iptali sadece garson veya müdür tarafından yapılabilir.",
      };
    }

    if (!["PENDING_WAITER_APPROVAL", "PENDING", "COMPLETED"].includes(order.status)) {
      return { success: false, message: "Bu sipariş için işlem yapılamaz." };
    }

    const items = order.items as {
      productId: number;
      quantity: number;
      price: number;
    }[];
    const line = items.find((i) => i.productId === productId);
    if (!line) {
      return { success: false, message: "Ürün bu siparişte yok." };
    }

    const alreadyCancelled = await prisma.orderItemCancellation.aggregate({
      where: { orderId, productId },
      _sum: { quantity: true },
    });
    const cancelledSoFar = alreadyCancelled._sum.quantity ?? 0;
    const maxCancel = line.quantity - cancelledSoFar;
    if (maxCancel <= 0) {
      return { success: false, message: "Bu kalem zaten tamamen işlenmiş." };
    }
    if (quantity > maxCancel || quantity < 1) {
      return {
        success: false,
        message: `İşlem adedi 1 ile ${maxCancel} arasında olmalı.`,
      };
    }

    if (!REASONS.includes(reason)) {
      return { success: false, message: "Geçerli bir işlem nedeni seçin." };
    }

    const reasonNote = customReason?.trim() || null;
    if (reason === "OTHER" && !reasonNote) {
      return {
        success: false,
        message: "Diğer nedeni seçildiğinde açıklama zorunludur.",
      };
    }

    const normalizedRefundedAmount = normalizeAmount(refundedAmount);
    const lineAmountUpperLimit = Math.round(Number(line.price) * quantity * 100) / 100;

    if (requestedMode === "REFUND") {
      if (!selectedPaymentMethod) {
        return { success: false, message: "İade için ödeme yöntemi seçmelisiniz." };
      }
      if (normalizedRefundedAmount == null || normalizedRefundedAmount <= 0) {
        return { success: false, message: "İade edilen tutar 0'dan büyük olmalıdır." };
      }
      if (normalizedRefundedAmount > lineAmountUpperLimit) {
        return {
          success: false,
          message: `İade tutarı en fazla ${lineAmountUpperLimit.toFixed(2)} olabilir.`,
        };
      }
    }

    if (
      requestedMode === "CANCEL" &&
      normalizedRefundedAmount != null &&
      normalizedRefundedAmount > lineAmountUpperLimit
    ) {
      return {
        success: false,
        message: `Tutar en fazla ${lineAmountUpperLimit.toFixed(2)} olabilir.`,
      };
    }

    const cancelledBy = staffId != null ? `${username} (#${staffId})` : username;

    let refundReference: string | null = null;
    let orderMarkedRejected = false;
    let remainingItemCountAfterCancel = 0;
    let remainingQuantityAfterCancel = 0;
    const requiresIyzicoRefund =
      requestedMode === "REFUND" &&
      selectedPaymentMethod === "IYZICO" &&
      isOrderPaidViaIyzico(order);

    if (requiresIyzicoRefund) {
      if (!isOrderRefundRuntimeReady()) {
        return {
          success: false,
          message: getOrderRefundRuntimeErrorMessage(),
        };
      }

      const refundAmount = normalizedRefundedAmount ?? lineAmountUpperLimit;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          refundStatus: "REFUND_PENDING",
          refundFailureReason: null,
        },
      });

      const refundResult = await refundPaidIyzicoOrder({
        tenantId,
        orderId: order.id,
        amount: refundAmount,
        paymentReference: order.paymentReference ?? null,
        paymentConversationId: order.paymentConversationId ?? null,
      });

      if (!refundResult.success) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            refundStatus: "REFUND_FAILED",
            refundFailureReason: refundResult.message.slice(0, 512),
          },
        });

        return {
          success: false,
          message: `İyzico iadesi başarısız: ${refundResult.message}`,
        };
      }

      refundReference = refundResult.refundReference ?? null;
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderItemCancellation.create({
        data: {
          tenantId,
          orderId,
          productId,
          quantity,
          reason,
          customReason: buildCancellationCustomReason({
            note: reasonNote,
            operationType: requestedMode,
            selectedPaymentMethod: selectedPaymentMethod ?? null,
            refundedAmount:
              requestedMode === "REFUND" ? normalizedRefundedAmount : null,
            paymentSettled,
          }),
          performedBy: cancelledBy,
        },
      });

      if (requiresIyzicoRefund) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            refundStatus: "REFUNDED",
            refundedAt: new Date(),
            refundReference,
            refundFailureReason: null,
          },
        });
      }

      const cancellationRows = await tx.orderItemCancellation.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });
      const cancelledByProduct = new Map<number, number>();
      for (const row of cancellationRows) {
        cancelledByProduct.set(
          row.productId,
          (cancelledByProduct.get(row.productId) ?? 0) + row.quantity,
        );
      }

      remainingItemCountAfterCancel = 0;
      remainingQuantityAfterCancel = 0;
      for (const item of items) {
        const remainingQty = Math.max(
          0,
          item.quantity - (cancelledByProduct.get(item.productId) ?? 0),
        );
        if (remainingQty > 0) {
          remainingItemCountAfterCancel += 1;
          remainingQuantityAfterCancel += remainingQty;
        }
      }

      if (
        remainingQuantityAfterCancel <= 0 &&
        (order.status === "PENDING_WAITER_APPROVAL" || order.status === "PENDING")
      ) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "REJECTED" },
        });
        orderMarkedRejected = true;
      }
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "ORDER_ITEM_CANCEL",
      entityType: "Order",
      entityId: String(orderId),
      description:
        requestedMode === "REFUND"
          ? `Urun iadesi: ${quantity} adet, ${reason}, yontem=${selectedPaymentMethod ?? "-"}, tutar=${(normalizedRefundedAmount ?? 0).toFixed(2)}, ref=${refundReference ?? "-"}`
          : `Urun iptali: ${quantity} adet, ${reason}`,
    });

    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/restaurant");
    revalidatePath("/restaurant/orders");
    revalidatePath("/restaurant/cancellations");
    revalidatePath("/restaurant/reports");
    revalidatePath("/[tableId]", "page");
    revalidatePath("/menu/[slug]/[tableId]", "page");
    revalidatePath("/menu", "layout");
    revalidatePath(`/${order.tableId}`);

    return {
      success: true,
      message:
        requestedMode === "REFUND"
          ? "İade işlemi başarıyla kaydedildi."
          : "İptal işlemi başarıyla kaydedildi.",
      meta: {
        orderId,
        productId,
        quantity,
        requestedMode,
        selectedPaymentMethod: selectedPaymentMethod ?? null,
        refundedAmount: normalizedRefundedAmount,
        requiresIyzicoRefund,
        refundReference,
        orderMarkedRejected,
        remainingItemCountAfterCancel,
        remainingQuantityAfterCancel,
      },
    };
  } catch (e) {
    if (e instanceof RateLimitError) {
      return {
        success: false,
        message: e.message,
        rateLimit: {
          code: e.code,
          retryAfterSeconds: e.retryAfterSeconds,
        },
      };
    }
    logServerError("cancel-order-item", e);
    return { success: false, message: "İşlem kaydedilemedi." };
  }
}
