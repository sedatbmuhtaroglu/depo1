import type { OrderPaymentStatus, PaymentGatewayProvider, PaymentMethod } from "@prisma/client";
import { parseCancellationCustomReason } from "@/lib/order-cancellation-finance";

type NumericLike = number | { toString(): string };

type OrderItem = { productId: number; quantity: number; price: number };

export type CompletedOrderMetricsInput = {
  id: number;
  status: "COMPLETED";
  deliveredAt: Date | null;
  totalPrice: NumericLike;
  items: unknown;
  requestedPaymentMethod: PaymentMethod | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentProvider: PaymentGatewayProvider | null;
};

export type PaymentMetricsInput = {
  amount: NumericLike;
  method: PaymentMethod;
  gatewayProvider: PaymentGatewayProvider | null;
};

export type CancellationMetricsInput = {
  orderId: number;
  productId: number;
  quantity: number;
  customReason: string | null;
  order: {
    status: "PENDING_WAITER_APPROVAL" | "PENDING" | "PREPARING" | "COMPLETED" | "REJECTED";
    deliveredAt: Date | null;
    requestedPaymentMethod: PaymentMethod | null;
    paymentStatus: OrderPaymentStatus | null;
    paymentProvider: PaymentGatewayProvider | null;
    items: unknown;
  };
};

export type CashAdjustmentMetricsInput = {
  orderId: number;
  totalAmountDelta: NumericLike;
};

type MethodBucket = Record<string, { total: number; count: number }>;

function toNumber(value: NumericLike): number {
  return Number(value);
}

/** Sum of all payment-method buckets after the same adjustments as net revenue (single source of truth). */
export function sumMethodBucketTotals(byMethod: MethodBucket): number {
  return Object.values(byMethod).reduce((sum, method) => sum + method.total, 0);
}

function getMethodBucketKey(order: {
  requestedPaymentMethod: PaymentMethod | null;
  paymentProvider: PaymentGatewayProvider | null;
}): string {
  if (order.paymentProvider === "IYZICO") return "IYZICO";
  return order.requestedPaymentMethod ?? "CASH";
}

function findUnitPriceFromOrderItems(items: unknown, productId: number): number {
  const rows = Array.isArray(items) ? (items as OrderItem[]) : [];
  const matched = rows.find((row) => row.productId === productId);
  if (!matched) return 0;
  const unitPrice = Number(matched.price);
  return Number.isFinite(unitPrice) ? unitPrice : 0;
}

export function classifyFinancialRefund(params: {
  orderId: number;
  deliveredAt: Date | null;
  operationType: "CANCEL" | "REFUND" | null;
  paymentSettled: boolean | null;
  refundedAmount: number | null;
}): { affectsBalance: boolean; effectiveRefundAmount: number } {
  const delivered = params.deliveredAt != null;
  const operationType = params.operationType;
  const paymentSettled = params.paymentSettled === true;
  const refundedAmount = params.refundedAmount ?? 0;
  const hasPositiveRefund = Number.isFinite(refundedAmount) && refundedAmount > 0;
  const affectsBalance =
    operationType === "REFUND" && paymentSettled && hasPositiveRefund && delivered;

  return {
    affectsBalance,
    effectiveRefundAmount: affectsBalance ? refundedAmount : 0,
  };
}

export type UnifiedRevenueMetrics = {
  completedOrderCount: number;
  grossRevenue: number;
  netRevenue: number;
  averageOrderAmount: number | null;
  byMethod: MethodBucket;
  financialRefundAmount: number;
  operationalUnpaidDeliveredCancelAmount: number;
  operationalUnpaidDeliveredCancelCount: number;
  cashAdjustmentDeduction: number;
  cashAdjustmentCount: number;
  scopeSummary: string;
};

export function calculateUnifiedRevenueMetrics(params: {
  completedOrders: CompletedOrderMetricsInput[];
  payments: PaymentMetricsInput[];
  cancellations: CancellationMetricsInput[];
  cashAdjustments: CashAdjustmentMetricsInput[];
}): UnifiedRevenueMetrics {
  const { completedOrders, payments, cancellations, cashAdjustments } = params;

  const completedOrderIds = new Set(completedOrders.map((order) => order.id));
  const completedCancellations = cancellations.filter((row) => completedOrderIds.has(row.orderId));
  const completedCashAdjustments = cashAdjustments.filter((row) => completedOrderIds.has(row.orderId));

  const byMethod: MethodBucket = {};
  for (const payment of payments) {
    const methodKey = payment.gatewayProvider === "IYZICO" ? "IYZICO" : payment.method;
    if (!byMethod[methodKey]) byMethod[methodKey] = { total: 0, count: 0 };
    byMethod[methodKey].total += toNumber(payment.amount);
    byMethod[methodKey].count += 1;
  }

  const grossRevenue = sumMethodBucketTotals(byMethod);

  let financialRefundAmount = 0;
  let operationalUnpaidDeliveredCancelAmount = 0;
  let operationalUnpaidDeliveredCancelCount = 0;

  for (const cancellation of completedCancellations) {
    const parsed = parseCancellationCustomReason(cancellation.customReason);

    const unitPrice = findUnitPriceFromOrderItems(cancellation.order.items, cancellation.productId);
    const unitImpact = unitPrice * cancellation.quantity;
    if (unitImpact <= 0) continue;

    const refundClassification = classifyFinancialRefund({
      orderId: cancellation.orderId,
      deliveredAt: cancellation.order.deliveredAt,
      operationType: parsed.operationType,
      paymentSettled: parsed.paymentSettled,
      refundedAmount: parsed.refundedAmount,
    });

    if (refundClassification.affectsBalance) {
      financialRefundAmount += refundClassification.effectiveRefundAmount;
      const methodKey =
        parsed.selectedPaymentMethod ?? getMethodBucketKey(cancellation.order);
      if (!byMethod[methodKey]) byMethod[methodKey] = { total: 0, count: 0 };
      byMethod[methodKey].total -= refundClassification.effectiveRefundAmount;
      continue;
    }

    if (cancellation.order.deliveredAt != null) {
      operationalUnpaidDeliveredCancelAmount += unitImpact;
      operationalUnpaidDeliveredCancelCount += 1;
    }
  }

  const cashAdjustmentNetDelta = completedCashAdjustments.reduce(
    (sum, adjustment) => sum + toNumber(adjustment.totalAmountDelta),
    0,
  );
  if (cashAdjustmentNetDelta !== 0) {
    if (!byMethod.CASH) byMethod.CASH = { total: 0, count: 0 };
    byMethod.CASH.total += cashAdjustmentNetDelta;
  }
  const cashAdjustmentDeduction = Math.abs(Math.min(0, cashAdjustmentNetDelta));

  const netRevenue = sumMethodBucketTotals(byMethod);
  const completedOrderCount = completedOrders.length;
  const averageOrderAmount =
    completedOrderCount > 0 ? netRevenue / completedOrderCount : null;

  return {
    completedOrderCount,
    grossRevenue,
    netRevenue,
    averageOrderAmount,
    byMethod,
    financialRefundAmount,
    operationalUnpaidDeliveredCancelAmount,
    operationalUnpaidDeliveredCancelCount,
    cashAdjustmentDeduction,
    cashAdjustmentCount: completedCashAdjustments.length,
    scopeSummary:
      "Net ciro: secili aralikta Payment satirlari (tahsilat kaydi) toplami; finansal iade ve nakit duzeltmeler sonrasi yontem kutularinin toplami ile ayni. PaymentIntent INITIATED/PENDING dahil degildir (Payment satiri yok). Finansal iade: parse edilen REFUND + teslim + odeme yerlesmis. Operasyonel iptal: odenmemis+teslim; net cirodan dusulmez.",
  };
}

