import React from "react";
import type { OrderPaymentStatus, PaymentGatewayProvider, PaymentMethod } from "@prisma/client";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getEndOfDayReportForTenant } from "@/lib/end-of-day-report";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import { calculateUnifiedRevenueMetrics } from "@/lib/report-order-metrics";
import ReportsView from "./reports-view";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";

export const dynamic = "force-dynamic";

type OrderItem = { productId: number; quantity: number; price: number };

type CompletedOrderSnapshot = {
  id: number;
  createdAt: Date;
  deliveredAt: Date | null;
  totalPrice: number | { toString(): string };
  items: unknown;
  requestedPaymentMethod: string | null;
  paymentStatus: string | null;
  paymentProvider: string | null;
  refundStatus?: "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";
  table: { tableNo: number };
};

type CancellationSnapshot = {
  orderId: number;
  quantity: number;
  reason: string;
  performedBy: string | null;
  productId: number;
  customReason: string | null;
  order: {
    status: "PENDING_WAITER_APPROVAL" | "PENDING" | "PREPARING" | "COMPLETED" | "REJECTED";
    deliveredAt: Date | null;
    requestedPaymentMethod: string | null;
    paymentStatus: string | null;
    paymentProvider: string | null;
    items: unknown;
  };
};

type CashAdjustmentSnapshot = {
  orderId: number;
  productId: number;
  adjustedQuantity: number;
  totalAmountDelta: number | { toString(): string };
  actionType: "PARTIAL_CANCEL" | "PARTIAL_RETURN";
};

const METHOD_LABELS: Record<string, string> = {
  IYZICO: "İyzico ile Öde",
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

const REASON_LABELS: Record<string, string> = {
  CUSTOMER_CHANGED_MIND: "Müşteri fikrini değiştirdi",
  OUT_OF_STOCK: "Stokta yok",
  WRONG_ITEM: "Yanlış ürün",
  OTHER: "Diğer",
};

function normalizeDateParam(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  return value;
}

function isIyzicoPaidOrder(order: {
  requestedPaymentMethod: string | null;
  paymentStatus: string | null;
  paymentProvider: string | null;
}): boolean {
  if (order.requestedPaymentMethod !== "CREDIT_CARD") return false;
  if (order.paymentStatus !== "PAID") return false;
  return order.paymentProvider === "IYZICO" || order.paymentProvider == null;
}

export default async function RestaurantReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; day?: string }>;
}) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = await searchParams;

  const todayTurkeyDate = getTurkeyDateString();
  const selectedDay = normalizeDateParam(params.day, todayTurkeyDate);

  const fromDayRaw = normalizeDateParam(params.from, todayTurkeyDate);
  const toDayRaw = normalizeDateParam(params.to, fromDayRaw);
  const fromDay = fromDayRaw <= toDayRaw ? fromDayRaw : toDayRaw;
  const toDay = fromDayRaw <= toDayRaw ? toDayRaw : fromDayRaw;

  /** Single-day filter must drive gün sonu; otherwise `day` defaults to today and üst kart ≠ dönem özeti. */
  const effectiveEndOfDayDate = fromDay === toDay ? fromDay : selectedDay;

  const fromRange = getTurkeyDayRange(fromDay);
  const toRange = getTurkeyDayRange(toDay);
  const fromUtc = fromRange.startUtc;
  const toUtcExclusive = toRange.endUtc;

  const [payments, cancellations, completedOrders, cashAdjustments, dayEndReport] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          tenantId,
          createdAt: { gte: fromUtc, lt: toUtcExclusive },
        },
        select: { amount: true, method: true, gatewayProvider: true },
      }),
      prisma.orderItemCancellation.findMany({
        where: {
          tenantId,
          createdAt: { gte: fromUtc, lt: toUtcExclusive },
        },
        select: {
          orderId: true,
          quantity: true,
          reason: true,
          performedBy: true,
          productId: true,
          customReason: true,
          order: {
            select: {
              status: true,
              deliveredAt: true,
              requestedPaymentMethod: true,
              paymentStatus: true,
              paymentProvider: true,
              items: true,
            },
          },
        },
      }),
      prisma.order.findMany({
        where: {
          table: { restaurant: { tenantId } },
          createdAt: { gte: fromUtc, lt: toUtcExclusive },
          status: "COMPLETED",
        },
        select: {
          id: true,
          createdAt: true,
          deliveredAt: true,
          totalPrice: true,
          items: true,
          requestedPaymentMethod: true,
          paymentStatus: true,
          paymentProvider: true,
          ...(prismaModelHasField("Order", "refundStatus")
            ? ({ refundStatus: true } as Record<string, true>)
            : {}),
          table: { select: { tableNo: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cashOrderAdjustment.findMany({
        where: {
          tenantId,
          createdAt: { gte: fromUtc, lt: toUtcExclusive },
        },
        select: {
          orderId: true,
          productId: true,
          adjustedQuantity: true,
          totalAmountDelta: true,
          actionType: true,
        },
      }),
      getEndOfDayReportForTenant({
        tenantId,
        date: effectiveEndOfDayDate,
      }),
    ]);

  const completedOrderRows = completedOrders as CompletedOrderSnapshot[];
  const cancellationRows = cancellations as CancellationSnapshot[];
  const cashAdjustmentRows = cashAdjustments as CashAdjustmentSnapshot[];
  const completedOrderIds = completedOrderRows.map((order) => order.id);
  const completedCancellationRows = cancellationRows
    .filter((row) => completedOrderIds.includes(row.orderId))
    .map((row) => ({
      orderId: row.orderId,
      productId: row.productId,
      quantity: row.quantity,
    }));
  const completedCashAdjustmentRows = cashAdjustmentRows.filter((row) =>
    completedOrderIds.includes(row.orderId),
  );
  const cancellationMap = buildOrderItemAdjustmentMap(completedCancellationRows);
  const cashAdjustmentMap = buildOrderItemAdjustmentMap(
    completedCashAdjustmentRows.map((row) => ({
      orderId: row.orderId,
      productId: row.productId,
      quantity: row.adjustedQuantity,
    })),
  );

  const productAgg: Record<number, { quantity: number; revenue: number }> = {};
  for (const order of completedOrderRows) {
    const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
    for (const item of items) {
      const effectiveQuantity = getEffectiveOrderItemQuantity({
        orderId: order.id,
        productId: item.productId,
        originalQuantity: item.quantity,
        cancellationMap,
        cashAdjustmentMap,
      });
      if (effectiveQuantity <= 0) continue;
      if (!productAgg[item.productId]) {
        productAgg[item.productId] = { quantity: 0, revenue: 0 };
      }
      productAgg[item.productId].quantity += effectiveQuantity;
      productAgg[item.productId].revenue += effectiveQuantity * Number(item.price);
    }
  }

  const productIds = Object.keys(productAgg).map(Number);
  const productNames =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, nameTR: true },
        })
      : [];
  const nameMap = Object.fromEntries(
    productNames.map((product) => [product.id, product.nameTR]),
  );

  const topProducts = Object.entries(productAgg)
    .map(([id, data]) => ({
      productId: Number(id),
      name: nameMap[Number(id)] ?? "-",
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 50);

  const iyzicoPaidOrders = completedOrderRows
    .filter((order) => isIyzicoPaidOrder(order))
    .map((order) => {
      const refundStatus: "NONE" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED" =
        order.refundStatus === "REFUND_PENDING" ||
        order.refundStatus === "REFUNDED" ||
        order.refundStatus === "REFUND_FAILED"
          ? order.refundStatus
          : "NONE";
      const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
      const itemSummary = items
        .map((item) => `${item.quantity}x ${nameMap[item.productId] ?? `Ürün #${item.productId}`}`)
        .join(", ");
      return {
        orderId: order.id,
        tableNo: order.table.tableNo,
        createdAt: order.createdAt.toISOString(),
        amount: Number(order.totalPrice),
        refundStatus,
        itemSummary,
      };
    });

  const iyzicoOrdersWithRefundProcess = iyzicoPaidOrders.filter(
    (order) => order.refundStatus !== "NONE",
  ).length;

  const periodMetrics = calculateUnifiedRevenueMetrics({
    completedOrders: completedOrderRows.map((order) => ({
      id: order.id,
      status: "COMPLETED" as const,
      deliveredAt: order.deliveredAt,
      totalPrice: order.totalPrice,
      items: order.items,
      requestedPaymentMethod: order.requestedPaymentMethod as PaymentMethod | null,
      paymentStatus: order.paymentStatus as OrderPaymentStatus | null,
      paymentProvider: order.paymentProvider as PaymentGatewayProvider | null,
    })),
    payments: payments.map((payment) => ({
      amount: payment.amount,
      method: payment.method,
      gatewayProvider: payment.gatewayProvider,
    })),
    cancellations: cancellationRows.map((row) => ({
      orderId: row.orderId,
      productId: row.productId,
      quantity: row.quantity,
      customReason: row.customReason,
      order: {
        status: row.order.status,
        deliveredAt: row.order.deliveredAt,
        requestedPaymentMethod: row.order.requestedPaymentMethod as PaymentMethod | null,
        paymentStatus: row.order.paymentStatus as OrderPaymentStatus | null,
        paymentProvider: row.order.paymentProvider as PaymentGatewayProvider | null,
        items: row.order.items,
      },
    })),
    cashAdjustments: cashAdjustmentRows.map((row) => ({
      orderId: row.orderId,
      totalAmountDelta: row.totalAmountDelta,
    })),
  });

  const byMethod = periodMetrics.byMethod;
  const grossRevenueBeforeCashAdjustments = periodMetrics.grossRevenue;
  const netRevenue = periodMetrics.netRevenue;
  const averageOrderAmount = periodMetrics.averageOrderAmount;
  const cashAdjustmentDeduction = periodMetrics.cashAdjustmentDeduction;
  const metricsScopeSummary =
    fromDay === toDay
      ? `${fromDay} tarihli sipariş raporu`
      : `${fromDay} - ${toDay} aralığındaki tamamlanan siparişler`;

  const byReason: Record<string, number> = {};
  const byPerformedBy: Record<string, { count: number; quantity: number }> = {};
  for (const cancellation of cancellationRows) {
    byReason[cancellation.reason] =
      (byReason[cancellation.reason] ?? 0) + cancellation.quantity;

    const key = cancellation.performedBy?.trim() || "Belirtilmemiş";
    if (!byPerformedBy[key]) {
      byPerformedBy[key] = { count: 0, quantity: 0 };
    }
    byPerformedBy[key].count += 1;
    byPerformedBy[key].quantity += cancellation.quantity;
  }

  const byPerformedByList = Object.entries(byPerformedBy).map(([name, data]) => ({
    name,
    count: data.count,
    quantity: data.quantity,
  }));

  const orderedMethods = [
    "IYZICO",
    "CASH",
    "CREDIT_CARD",
    "SODEXO",
    "MULTINET",
    "TICKET",
    "METROPOL",
  ];
  for (const method of orderedMethods) {
    if (!byMethod[method]) {
      byMethod[method] = { total: 0, count: 0 };
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[color:var(--ui-text-primary)]">Raporlar</h2>
      <ReportsView
        day={effectiveEndOfDayDate}
        dayEndReport={dayEndReport}
        from={fromDay}
        to={toDay}
        revenue={netRevenue}
        orderCount={completedOrderRows.length}
        averageOrderAmount={averageOrderAmount}
        metricsScopeSummary={metricsScopeSummary}
        byMethod={orderedMethods.map((method) => ({
          method,
          label: METHOD_LABELS[method] ?? method,
          total: byMethod[method]?.total ?? 0,
          count: byMethod[method]?.count ?? 0,
        }))}
        byReason={Object.entries(byReason).map(([reason, count]) => ({
          reason,
          label: REASON_LABELS[reason] ?? reason,
          count,
        }))}
        byPerformedBy={byPerformedByList}
        topProducts={topProducts}
        iyzicoPaidOrders={iyzicoPaidOrders}
        iyzicoOrdersWithRefundProcess={iyzicoOrdersWithRefundProcess}
        iyzicoCancellationImpact={periodMetrics.financialRefundAmount}
        totalRefundAmount={periodMetrics.financialRefundAmount}
        operationalUnpaidDeliveredCancelAmount={
          periodMetrics.operationalUnpaidDeliveredCancelAmount
        }
        operationalUnpaidDeliveredCancelCount={
          periodMetrics.operationalUnpaidDeliveredCancelCount
        }
        grossRevenueBeforeCashAdjustments={grossRevenueBeforeCashAdjustments}
        cashAdjustmentDeduction={cashAdjustmentDeduction}
        cashAdjustmentCount={periodMetrics.cashAdjustmentCount}
      />
    </div>
  );
}
