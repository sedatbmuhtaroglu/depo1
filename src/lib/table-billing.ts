import type {
  Prisma,
  PaymentGatewayProvider,
  PaymentMethod,
  OrderPaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCancellationCustomReason } from "@/lib/order-cancellation-finance";
import { classifyFinancialRefund } from "@/lib/report-order-metrics";

type BillingPrismaClient = Pick<
  Prisma.TransactionClient,
  "billRequest" | "order" | "payment" | "orderItemCancellation" | "cashOrderAdjustment"
>;

type TableCycleBoundary = {
  cycleStartAt: Date | null;
  settledBillRequestId: number | null;
};

type BillableOrderSnapshot = {
  id: number;
  items: unknown;
  totalPrice: number | { toString(): string };
  createdAt: Date;
  readyAt: Date | null;
  deliveredAt: Date | null;
  requestedPaymentMethod: PaymentMethod | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentProvider?: PaymentGatewayProvider | null;
};

export function isOrderPaidViaOnlineGateway(order: BillableOrderSnapshot): boolean {
  if (order.requestedPaymentMethod !== "CREDIT_CARD") {
    return false;
  }
  if (order.paymentStatus !== "PAID") {
    return false;
  }

  // Legacy compatibility: older records may not have paymentProvider filled.
  return order.paymentProvider === "IYZICO" || order.paymentProvider == null;
}

export function isOrderBillableForTablePayment(order: BillableOrderSnapshot): boolean {
  return !isOrderPaidViaOnlineGateway(order);
}

function getOrderCycleTimestamp(order: BillableOrderSnapshot): Date {
  return order.deliveredAt ?? order.readyAt ?? order.createdAt;
}

function isOrderInCurrentCycle(order: BillableOrderSnapshot, cycleStartAt: Date | null): boolean {
  if (!cycleStartAt) return true;
  return getOrderCycleTimestamp(order) > cycleStartAt;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getOrderLineMap(items: unknown): Map<number, { quantity: number; price: number }> {
  const map = new Map<number, { quantity: number; price: number }>();
  const rows = Array.isArray(items)
    ? (items as Array<{ productId: number; quantity: number; price: number }>)
    : [];

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
      continue;
    }
    existing.quantity += quantity;
  }

  return map;
}

function getAdjustmentMap(
  rows: Array<{ orderId: number; productId: number; quantity: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.orderId}:${row.productId}`;
    map.set(key, (map.get(key) ?? 0) + row.quantity);
  }
  return map;
}

function getEffectiveOrderTotal(params: {
  order: BillableOrderSnapshot;
  cancellationMap: Map<string, number>;
  cashAdjustmentMap: Map<string, number>;
}): number {
  const { order, cancellationMap, cashAdjustmentMap } = params;
  const lineMap = getOrderLineMap(order.items);
  let total = 0;

  for (const [productId, line] of lineMap.entries()) {
    const key = `${order.id}:${productId}`;
    const cancelledQty = cancellationMap.get(key) ?? 0;
    const adjustedQty = cashAdjustmentMap.get(key) ?? 0;
    const effectiveQty = Math.max(0, line.quantity - cancelledQty - adjustedQty);
    total += effectiveQty * line.price;
  }

  return roundCurrency(total);
}

async function getCurrentTableCycleBoundary(params: {
  tenantId: number;
  tableId: number;
  prismaClient?: BillingPrismaClient;
}): Promise<TableCycleBoundary> {
  const db = params.prismaClient ?? prisma;
  const latestSettledBill = await db.billRequest.findFirst({
    where: {
      tenantId: params.tenantId,
      tableId: params.tableId,
      status: "SETTLED",
      settledAt: { not: null },
    },
    orderBy: {
      settledAt: "desc",
    },
    select: {
      id: true,
      settledAt: true,
    },
  });

  return {
    cycleStartAt: latestSettledBill?.settledAt ?? null,
    settledBillRequestId: latestSettledBill?.id ?? null,
  };
}

export async function getCurrentTableCycleStart(params: {
  tenantId: number;
  tableId: number;
  prismaClient?: BillingPrismaClient;
}): Promise<Date | null> {
  const boundary = await getCurrentTableCycleBoundary(params);
  return boundary.cycleStartAt;
}

export async function getTableBillingSnapshot(params: {
  tenantId: number;
  tableId: number;
  prismaClient?: BillingPrismaClient;
}) {
  const { tenantId, tableId, prismaClient } = params;
  const db = prismaClient ?? prisma;
  const cycleBoundary = await getCurrentTableCycleBoundary({
    tenantId,
    tableId,
    prismaClient: db,
  });
  const cycleStartAt = cycleBoundary.cycleStartAt;
  const boundarySettledBillRequestId = cycleBoundary.settledBillRequestId;

  const cycleTimestampFilter = cycleStartAt ? { gt: cycleStartAt } : undefined;

  const [completedOrders, existingPayments] = await Promise.all([
    db.order.findMany({
      where: {
        tableId,
        status: "COMPLETED",
        ...(cycleTimestampFilter
          ? {
              OR: [
                { createdAt: cycleTimestampFilter },
                { readyAt: cycleTimestampFilter },
                { deliveredAt: cycleTimestampFilter },
              ],
            }
          : {}),
        table: {
          restaurant: { tenantId },
        },
      },
      select: {
        id: true,
        items: true,
        totalPrice: true,
        createdAt: true,
        readyAt: true,
        deliveredAt: true,
        requestedPaymentMethod: true,
        paymentStatus: true,
        paymentProvider: true,
      },
    }),
    db.payment.findMany({
      where: {
        tenantId,
        tableId,
        ...(cycleTimestampFilter ? { createdAt: cycleTimestampFilter } : {}),
        // Prevent previous cycle settlement payment from leaking into the next cycle.
        ...(boundarySettledBillRequestId != null
          ? { NOT: { billRequestId: boundarySettledBillRequestId } }
          : {}),
      },
      select: { amount: true },
    }),
  ]);

  const cycleOrders = completedOrders.filter((order) =>
    isOrderInCurrentCycle(order, cycleStartAt),
  );
  const cycleOrderIds = cycleOrders.map((order) => order.id);

  const [cancellations, cashAdjustments] = await Promise.all([
    cycleOrderIds.length > 0
      ? db.orderItemCancellation.findMany({
          where: {
            tenantId,
            orderId: { in: cycleOrderIds },
          },
          select: {
            orderId: true,
            productId: true,
            quantity: true,
            customReason: true,
            order: {
              select: {
                deliveredAt: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    cycleOrderIds.length > 0
      ? db.cashOrderAdjustment.findMany({
          where: {
            tenantId,
            orderId: { in: cycleOrderIds },
          },
          select: {
            orderId: true,
            productId: true,
            adjustedQuantity: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const cancellationMap = getAdjustmentMap(cancellations);
  const cashAdjustmentMap = getAdjustmentMap(
    cashAdjustments.map((adjustment) => ({
      orderId: adjustment.orderId,
      productId: adjustment.productId,
      quantity: adjustment.adjustedQuantity,
    })),
  );

  const effectiveTotalsByOrderId = new Map<number, number>();
  for (const order of cycleOrders) {
    effectiveTotalsByOrderId.set(
      order.id,
      getEffectiveOrderTotal({
        order,
        cancellationMap,
        cashAdjustmentMap,
      }),
    );
  }

  const onlinePaidTotal = cycleOrders
    .filter(isOrderPaidViaOnlineGateway)
    .reduce((sum, order) => sum + (effectiveTotalsByOrderId.get(order.id) ?? 0), 0);

  const totalFromOrders = cycleOrders
    .filter(isOrderBillableForTablePayment)
    .reduce((sum, order) => sum + (effectiveTotalsByOrderId.get(order.id) ?? 0), 0);
  const totalCompletedAmount = totalFromOrders + onlinePaidTotal;
  const grossPaidAmount = existingPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  let refundedAmount = 0;
  for (const cancellation of cancellations) {
    const parsed = parseCancellationCustomReason(cancellation.customReason);
    const refund = classifyFinancialRefund({
      orderId: cancellation.orderId,
      deliveredAt: cancellation.order.deliveredAt,
      operationType: parsed.operationType,
      paymentSettled: parsed.paymentSettled,
      refundedAmount: parsed.refundedAmount,
    });
    refundedAmount += refund.effectiveRefundAmount;
  }

  const netPaidAmount = grossPaidAmount - refundedAmount;
  const remainingAmount = totalFromOrders - netPaidAmount;
  const overpaidAmount = Math.max(0, netPaidAmount - totalFromOrders);
  const totalUnpaid = Math.max(0, remainingAmount);
  const totalPaid = netPaidAmount;

  return {
    totalAmount: totalFromOrders,
    totalFromOrders,
    totalCompletedAmount,
    onlinePaidTotal,
    grossPaidAmount,
    refundedAmount,
    netPaidAmount,
    remainingAmount,
    overpaidAmount,
    totalPaid,
    totalUnpaid,
    canRequestBill: totalUnpaid > 0,
    cycleStartAt,
    completedOrderCount: cycleOrders.length,
  };
}
