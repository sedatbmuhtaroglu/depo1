"use server";

import { prisma, prismaModelHasField } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";
import { isOrderAwaitingOnlinePayment, isOrderPaidViaIyzico } from "@/lib/order-payment-visibility";

type CashAdjustmentType = "PARTIAL_CANCEL" | "PARTIAL_RETURN";

type OrderItemRow = {
  productId: number;
  quantity: number;
  price: number;
};

class CashAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CashAdjustmentError";
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getOrderLineMap(items: unknown): Map<number, { quantity: number; price: number }> {
  const rows = Array.isArray(items) ? (items as OrderItemRow[]) : [];
  const map = new Map<number, { quantity: number; price: number }>();
  for (const row of rows) {
    const productId = Number(row.productId);
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0));
    const price = Number(row.price) || 0;
    if (!Number.isFinite(productId) || productId <= 0 || quantity <= 0 || !Number.isFinite(price)) {
      continue;
    }

    const existing = map.get(productId);
    if (!existing) {
      map.set(productId, { quantity, price });
    } else {
      existing.quantity += quantity;
    }
  }

  return map;
}

function isCashAdjustmentEligibleOrder(order: {
  requestedPaymentMethod:
    | "CASH"
    | "CREDIT_CARD"
    | "SODEXO"
    | "MULTINET"
    | "TICKET"
    | "METROPOL"
    | null;
  paymentStatus: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null;
  paymentProvider: "IYZICO" | null;
}): boolean {
  if (isOrderPaidViaIyzico(order)) return false;
  if (isOrderAwaitingOnlinePayment(order)) return false;
  return order.requestedPaymentMethod == null || order.requestedPaymentMethod === "CASH";
}

export async function adjustCashOrderItem(input: {
  orderId: number;
  orderItemId?: number;
  productId: number;
  quantity: number;
  reason: string;
  actionType: CashAdjustmentType;
}) {
  try {
    const { username, tenantId, staffId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const orderId = Number(input.orderId);
    const orderItemId =
      input.orderItemId == null ? null : Number(input.orderItemId);
    const productId = Number(input.productId);
    const quantity = Math.floor(Number(input.quantity));
    const reason = input.reason.trim();
    const actionType = input.actionType;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return { success: false, message: "Gecerli sipariş seciniz." };
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      return { success: false, message: "Gecerli urun seciniz." };
    }
    if (orderItemId != null && (!Number.isInteger(orderItemId) || orderItemId <= 0)) {
      return { success: false, message: "Gecerli sipariş satiri seciniz." };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { success: false, message: "Gecerli adet giriniz." };
    }
    if (!reason) {
      return { success: false, message: "Neden zorunludur." };
    }
    if (actionType !== "PARTIAL_CANCEL" && actionType !== "PARTIAL_RETURN") {
      return { success: false, message: "Gecerli islem tipi seciniz." };
    }

    const supportsProductStockFields =
      prismaModelHasField("Product", "trackStock") &&
      prismaModelHasField("Product", "stockQuantity");

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;

      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          table: { restaurant: { tenantId } },
        },
        select: {
          id: true,
          tableId: true,
          status: true,
          items: true,
          requestedPaymentMethod: true,
          paymentStatus: true,
          paymentProvider: true,
        },
      });

      if (!order) {
        throw new CashAdjustmentError("Sipariş bulunamadi.");
      }

      if (
        !["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING", "COMPLETED"].includes(
          order.status,
        )
      ) {
        throw new CashAdjustmentError("Bu sipariş durumunda kısmi iptal/iade yapilamaz.");
      }

      if (!isCashAdjustmentEligibleOrder(order)) {
        throw new CashAdjustmentError(
          "Bu islem sadece nakit veya sonra ode siparişlerinde kullanilabilir.",
        );
      }

      const lineMap = getOrderLineMap(order.items);
      const line = lineMap.get(productId);
      if (!line) {
        throw new CashAdjustmentError("Urun bu siparişte bulunamadi.");
      }
      if (orderItemId != null && orderItemId !== productId) {
        throw new CashAdjustmentError("Secilen sipariş satiri urun ile eslesmiyor.");
      }

      const [cancelledAgg, adjustedAgg] = await Promise.all([
        tx.orderItemCancellation.aggregate({
          where: { tenantId, orderId, productId },
          _sum: { quantity: true },
        }),
        tx.cashOrderAdjustment.aggregate({
          where: { tenantId, orderId, productId },
          _sum: { adjustedQuantity: true },
        }),
      ]);
      const cancelledQty = cancelledAgg._sum.quantity ?? 0;
      const adjustedQty = adjustedAgg._sum.adjustedQuantity ?? 0;
      const effectiveQty = Math.max(0, line.quantity - cancelledQty - adjustedQty);
      if (quantity > effectiveQty) {
        throw new CashAdjustmentError(
          `En fazla ${effectiveQty} adet icin kısmi iptal/iade yapabilirsiniz.`,
        );
      }

      const product = await tx.product.findFirst({
        where: {
          id: productId,
          category: { restaurant: { tenantId } },
        },
        select: {
          id: true,
          nameTR: true,
          ...(supportsProductStockFields
            ? ({ trackStock: true, stockQuantity: true } as Record<string, true>)
            : {}),
        },
      });
      if (!product) {
        throw new CashAdjustmentError("Urun kaydi bulunamadi.");
      }

      const amountDeltaAbs = roundCurrency(line.price * quantity);
      await tx.cashOrderAdjustment.create({
        data: {
          tenantId,
          orderId: order.id,
          orderItemId: orderItemId ?? productId,
          productId,
          adjustedQuantity: quantity,
          unitPriceSnapshot: line.price,
          totalAmountDelta: -amountDeltaAbs,
          reason,
          actionType,
          actorUserId: staffId ?? null,
        },
      });

      if (supportsProductStockFields && (product as { trackStock?: boolean }).trackStock) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: {
              increment: quantity,
            },
          },
        });
      }

      const [allCancellations, allAdjustments] = await Promise.all([
        tx.orderItemCancellation.findMany({
          where: { orderId: order.id },
          select: { productId: true, quantity: true },
        }),
        tx.cashOrderAdjustment.findMany({
          where: { orderId: order.id },
          select: { productId: true, adjustedQuantity: true },
        }),
      ]);
      const cancelledMap = new Map<number, number>();
      for (const row of allCancellations) {
        cancelledMap.set(row.productId, (cancelledMap.get(row.productId) ?? 0) + row.quantity);
      }
      const adjustedMap = new Map<number, number>();
      for (const row of allAdjustments) {
        adjustedMap.set(
          row.productId,
          (adjustedMap.get(row.productId) ?? 0) + row.adjustedQuantity,
        );
      }

      let remainingQuantityAfterAdjustment = 0;
      let nextOrderTotal = 0;
      for (const [itemProductId, item] of lineMap.entries()) {
        const remainingQty = Math.max(
          0,
          item.quantity -
            (cancelledMap.get(itemProductId) ?? 0) -
            (adjustedMap.get(itemProductId) ?? 0),
        );
        remainingQuantityAfterAdjustment += remainingQty;
        nextOrderTotal += remainingQty * item.price;
      }
      nextOrderTotal = roundCurrency(nextOrderTotal);

      const shouldRejectOrder =
        remainingQuantityAfterAdjustment <= 0 &&
        (order.status === "PENDING_WAITER_APPROVAL" || order.status === "PENDING");

      await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: nextOrderTotal,
          ...(shouldRejectOrder ? { status: "REJECTED" } : {}),
        },
      });

      return {
        orderId: order.id,
        tableId: order.tableId,
        productName: product.nameTR,
        amountDeltaAbs,
      };
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "ORDER_CASH_ADJUST",
      entityType: "Order",
      entityId: String(result.orderId),
      description: `${input.actionType} product=${productId} qty=${quantity} reason=${reason}`,
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");
    revalidatePath("/restaurant/orders");
    revalidatePath("/restaurant/reports");
    revalidatePath("/kitchen");
    revalidatePath("/[tableId]", "page");
    revalidatePath("/menu/[slug]/[tableId]", "page");
    revalidatePath("/menu", "layout");
    revalidatePath(`/${result.tableId}`);

    return {
      success: true,
      message: `${result.productName} icin kısmi ${input.actionType === "PARTIAL_RETURN" ? "iade" : "iptal"} uygulandi.`,
      amountDelta: result.amountDeltaAbs,
    };
  } catch (error) {
    if (error instanceof CashAdjustmentError) {
      return { success: false, message: error.message };
    }
    logServerError("adjust-cash-order-item", error);
    return { success: false, message: "Kısmi iptal/iade islemi basarisiz oldu." };
  }
}

