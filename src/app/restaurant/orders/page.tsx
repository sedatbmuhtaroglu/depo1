import React from "react";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";
import { cardClasses } from "@/lib/ui/button-variants";
import OrderTracking from "./order-tracking";

export const dynamic = "force-dynamic";

type StoredItem = { productId: number; quantity: number; price: number };

function parseRiskReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((reason): reason is string => typeof reason === "string");
}

type RestaurantOrdersPageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export default async function RestaurantOrdersPage({
  searchParams,
}: RestaurantOrdersPageProps) {
  const { tenantId } = await getCurrentTenantOrThrow();

  const resolvedSearchParams = (await searchParams) ?? {};
  const pageParam = resolvedSearchParams.page;
  const pageNumber = Number(pageParam);
  const currentPage = !pageParam || Number.isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber;
  const pageSize = 15;
  const skip = (currentPage - 1) * pageSize;

  const [totalCount, orders, products] = await Promise.all([
    prisma.order.count({
      where: {
        table: { restaurant: { tenantId } },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
    }),
    prisma.order.findMany({
      where: {
        table: { restaurant: { tenantId } },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
      include: { table: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.product.findMany({
      where: { category: { restaurant: { tenantId } } },
      select: { id: true, nameTR: true },
    }),
  ]);

  const orderIds = orders.map((order) => order.id);
  const [cancellations, cashAdjustments] = await Promise.all([
    orderIds.length > 0
      ? prisma.orderItemCancellation.findMany({
          where: { tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, quantity: true },
        })
      : Promise.resolve([]),
    orderIds.length > 0
      ? prisma.cashOrderAdjustment.findMany({
          where: { tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, adjustedQuantity: true },
        })
      : Promise.resolve([]),
  ]);

  const productMap = Object.fromEntries(products.map((p) => [p.id, p.nameTR]));
  const cancellationMap = buildOrderItemAdjustmentMap(cancellations);
  const cashAdjustmentMap = buildOrderItemAdjustmentMap(
    cashAdjustments.map((adjustment) => ({
      orderId: adjustment.orderId,
      productId: adjustment.productId,
      quantity: adjustment.adjustedQuantity,
    })),
  );
  const hasRefundStatusField = prismaModelHasField("Order", "refundStatus");

  const ordersWithItems = orders.map((order) => {
    const items = (order.items as StoredItem[]).map((item) => {
      const key = `${order.id}:${item.productId}`;
      const cancelledQuantity = cancellationMap.get(key) ?? 0;
      const adjustedQuantity = cashAdjustmentMap.get(key) ?? 0;
      const effectiveQuantity = getEffectiveOrderItemQuantity({
        orderId: order.id,
        productId: item.productId,
        originalQuantity: item.quantity,
        cancellationMap,
        cashAdjustmentMap,
      });

      return {
        ...item,
        productName: productMap[item.productId] ?? "-",
        cancelledQuantity,
        adjustedQuantity,
        effectiveQuantity,
      };
    });

    const originalTotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const effectiveTotal = items.reduce(
      (sum, item) => sum + Number(item.price) * item.effectiveQuantity,
      0,
    );

    return {
      id: order.id,
      tableNo: order.table.tableNo,
      status: order.status,
      totalPrice: order.totalPrice.toString(),
      originalTotalPrice: originalTotal,
      effectiveTotalPrice: effectiveTotal,
      createdAt: order.createdAt,
      readyAt: order.readyAt,
      preparingStartedAt: order.preparingStartedAt,
      deliveredAt: order.deliveredAt,
      note: order.note,
      items,
      cancellationCount: items.reduce((sum, item) => sum + item.cancelledQuantity, 0),
      cashAdjustmentCount: items.reduce((sum, item) => sum + item.adjustedQuantity, 0),
      isRiskFlagged: order.isRiskFlagged,
      riskScore: order.riskScore,
      riskLevel: order.riskLevel,
      riskReasons: parseRiskReasons(order.riskReasons),
      requestedPaymentMethod: order.requestedPaymentMethod,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      refundStatus: hasRefundStatusField
        ? ((order as { refundStatus?: string | null }).refundStatus ?? "NONE")
        : "NONE",
    };
  });

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5 shadow-none" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
          Sipariş Operasyonu
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Sipariş Takibi</h2>
        <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
          Sipariş akışlarını, durum önceliklerini ve ödeme sinyallerini tek ekrandan yönetin.
        </p>
      </section>
      <OrderTracking
        orders={ordersWithItems}
        page={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
      />
    </div>
  );
}
