import { prisma } from "@/lib/prisma";
import { getTurkeyDayRange } from "@/lib/turkey-time";
import { calculateUnifiedRevenueMetrics, sumMethodBucketTotals } from "@/lib/report-order-metrics";
import { formatStaffDisplayName } from "@/lib/person-display-name";

type CompletedOrderSnapshot = {
  id: number;
  createdAt: Date;
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  items: unknown;
  totalPrice: number | { toString(): string };
  requestedPaymentMethod: "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL" | null;
  paymentStatus: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null;
  paymentProvider: "IYZICO" | null;
  table: { tableNo: number };
};

type CancellationSnapshot = {
  orderId: number;
  productId: number;
  quantity: number;
  customReason: string | null;
  order: {
    status: "PENDING_WAITER_APPROVAL" | "PENDING" | "PREPARING" | "COMPLETED" | "REJECTED";
    deliveredAt: Date | null;
    requestedPaymentMethod: "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL" | null;
    paymentStatus: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null;
    paymentProvider: "IYZICO" | null;
    items: unknown;
  };
};

function toAverageMinutes(valuesMs: number[]): number | null {
  if (valuesMs.length === 0) return null;
  const avgMs = valuesMs.reduce((sum, current) => sum + current, 0) / valuesMs.length;
  return Math.round(avgMs / 60000);
}

export type EndOfDayReportResult = {
  date: string;
  completedOrderCount: number;
  longestDeliveryOrder: {
    orderId: number;
    tableNo: number;
    durationMinutes: number;
    completedAtIso: string;
  } | null;
  averageDeliveryMinutes: number | null;
  averagePreparationMinutes: number | null;
  averageWaiterResponseMinutes: number | null;
  averageOrderAmount: number | null;
  totalRevenue: number;
  grossRevenueBeforeCashAdjustments: number;
  financialRefundDeduction: number;
  operationalUnpaidDeliveredCancelAmount: number;
  operationalUnpaidDeliveredCancelCount: number;
  cashAdjustmentDeduction: number;
  cashRevenue: number;
  iyzicoRevenue: number;
  creditCardRevenue: number;
  sodexoRevenue: number;
  multinetRevenue: number;
  ticketRevenue: number;
  metropolRevenue: number;
  paymentMethodBreakdown: Array<{
    method: string;
    total: number;
    count: number;
  }>;
  waiterAverages: Array<{
    staffId: number;
    name: string;
    averageMinutes: number | null;
    sampleCount: number;
  }>;
  definitions: {
    longestDelivery: string;
    deliveryAverage: string;
    preparationAverage: string;
    waiterResponseAverage: string;
    revenueInclusion: string;
  };
};

const REPORT_METHOD_ORDER = [
  "CASH",
  "IYZICO",
  "CREDIT_CARD",
  "SODEXO",
  "MULTINET",
  "TICKET",
  "METROPOL",
] as const;

export async function getEndOfDayReportForTenant(params: {
  tenantId: number;
  date?: string | null;
}): Promise<EndOfDayReportResult> {
  const { tenantId, date } = params;
  const dayRange = getTurkeyDayRange(date);

  const [orders, waiterCalls, billRequests, payments, cancellations, cashAdjustments] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          table: { restaurant: { tenantId } },
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
          status: "COMPLETED",
        },
        select: {
          id: true,
          createdAt: true,
          preparingStartedAt: true,
          readyAt: true,
          deliveredAt: true,
          items: true,
          totalPrice: true,
          requestedPaymentMethod: true,
          paymentStatus: true,
          paymentProvider: true,
          table: { select: { tableNo: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.waiterCall.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        },
        select: {
          createdAt: true,
          acknowledgedAt: true,
          resolvedAt: true,
          acknowledgedByStaffId: true,
        },
      }),
      prisma.billRequest.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        },
        select: {
          createdAt: true,
          acknowledgedAt: true,
          settledAt: true,
          acknowledgedByStaffId: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        },
        select: { amount: true, method: true, gatewayProvider: true },
      }),
      prisma.orderItemCancellation.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        },
        select: {
          orderId: true,
          productId: true,
          quantity: true,
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
      prisma.cashOrderAdjustment.findMany({
        where: {
          tenantId,
          createdAt: { gte: dayRange.startUtc, lt: dayRange.endUtc },
        },
        select: { orderId: true, totalAmountDelta: true },
      }),
    ]);

  const completedOrders = orders as CompletedOrderSnapshot[];
  const unifiedMetrics = calculateUnifiedRevenueMetrics({
    completedOrders: completedOrders.map((order) => ({ ...order, status: "COMPLETED" as const })),
    payments: payments.map((payment) => ({
      amount: payment.amount,
      method: payment.method,
      gatewayProvider: payment.gatewayProvider,
    })),
    cancellations: cancellations as CancellationSnapshot[],
    cashAdjustments: cashAdjustments.map((row) => ({
      orderId: row.orderId,
      totalAmountDelta: row.totalAmountDelta,
    })),
  });
  const paymentMethodBreakdown = REPORT_METHOD_ORDER.map((method) => ({
    method,
    total: unifiedMetrics.byMethod[method]?.total ?? 0,
    count: unifiedMetrics.byMethod[method]?.count ?? 0,
  }));

  const deliveryDurations = completedOrders
    .map((order) => {
      const completedAt = order.deliveredAt ?? order.readyAt;
      if (!completedAt) return null;
      const diff = completedAt.getTime() - order.createdAt.getTime();
      if (diff < 0) return null;
      return { order, diffMs: diff, completedAt };
    })
    .filter((value): value is { order: CompletedOrderSnapshot; diffMs: number; completedAt: Date } => Boolean(value));

  const longestDelivery = deliveryDurations.reduce<{
    order: CompletedOrderSnapshot;
    diffMs: number;
    completedAt: Date;
  } | null>((current, candidate) => {
    if (!current) return candidate;
    if (candidate.diffMs > current.diffMs) return candidate;
    return current;
  }, null);

  const preparationDurations = completedOrders
    .map((order) => {
      if (!order.preparingStartedAt) return null;
      const completedAt = order.readyAt ?? order.deliveredAt;
      if (!completedAt) return null;
      const diff = completedAt.getTime() - order.preparingStartedAt.getTime();
      if (diff < 0) return null;
      return diff;
    })
    .filter((value): value is number => typeof value === "number");

  const waiterResponseDurations: number[] = [];
  const waiterResponseByStaff = new Map<number, number[]>();
  const includeWaiterDuration = (durationMs: number, staffId: number | null) => {
    if (durationMs < 0) return;
    waiterResponseDurations.push(durationMs);
    if (staffId == null) return;
    const existing = waiterResponseByStaff.get(staffId) ?? [];
    existing.push(durationMs);
    waiterResponseByStaff.set(staffId, existing);
  };

  for (const call of waiterCalls) {
    const handledAt = call.acknowledgedAt ?? call.resolvedAt;
    if (!handledAt) continue;
    includeWaiterDuration(
      handledAt.getTime() - call.createdAt.getTime(),
      call.acknowledgedByStaffId ?? null,
    );
  }

  for (const request of billRequests) {
    const handledAt = request.acknowledgedAt ?? request.settledAt;
    if (!handledAt) continue;
    includeWaiterDuration(
      handledAt.getTime() - request.createdAt.getTime(),
      request.acknowledgedByStaffId ?? null,
    );
  }

  const staffIds = [...waiterResponseByStaff.keys()];
  const staffList =
    staffIds.length > 0
      ? await prisma.tenantStaff.findMany({
          where: { tenantId, id: { in: staffIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
  const staffNameMap = new Map(staffList.map((staff) => [staff.id, formatStaffDisplayName(staff)]));
  const waiterAverages = staffIds
    .map((staffId) => {
      const durations = waiterResponseByStaff.get(staffId) ?? [];
      return {
        staffId,
        name: staffNameMap.get(staffId) ?? `#${staffId}`,
        averageMinutes: toAverageMinutes(durations),
        sampleCount: durations.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return {
    date: dayRange.date,
    completedOrderCount: unifiedMetrics.completedOrderCount,
    longestDeliveryOrder: longestDelivery
      ? {
          orderId: longestDelivery.order.id,
          tableNo: longestDelivery.order.table.tableNo,
          durationMinutes: Math.round(longestDelivery.diffMs / 60000),
          completedAtIso: longestDelivery.completedAt.toISOString(),
        }
      : null,
    averageDeliveryMinutes: toAverageMinutes(deliveryDurations.map((item) => item.diffMs)),
    averagePreparationMinutes: toAverageMinutes(preparationDurations),
    averageWaiterResponseMinutes: toAverageMinutes(waiterResponseDurations),
    averageOrderAmount: unifiedMetrics.averageOrderAmount,
    totalRevenue: sumMethodBucketTotals(unifiedMetrics.byMethod),
    grossRevenueBeforeCashAdjustments: unifiedMetrics.grossRevenue,
    financialRefundDeduction: unifiedMetrics.financialRefundAmount,
    operationalUnpaidDeliveredCancelAmount: unifiedMetrics.operationalUnpaidDeliveredCancelAmount,
    operationalUnpaidDeliveredCancelCount: unifiedMetrics.operationalUnpaidDeliveredCancelCount,
    cashAdjustmentDeduction: unifiedMetrics.cashAdjustmentDeduction,
    cashRevenue: unifiedMetrics.byMethod.CASH?.total ?? 0,
    iyzicoRevenue: unifiedMetrics.byMethod.IYZICO?.total ?? 0,
    creditCardRevenue: unifiedMetrics.byMethod.CREDIT_CARD?.total ?? 0,
    sodexoRevenue: unifiedMetrics.byMethod.SODEXO?.total ?? 0,
    multinetRevenue: unifiedMetrics.byMethod.MULTINET?.total ?? 0,
    ticketRevenue: unifiedMetrics.byMethod.TICKET?.total ?? 0,
    metropolRevenue: unifiedMetrics.byMethod.METROPOL?.total ?? 0,
    paymentMethodBreakdown,
    waiterAverages,
    definitions: {
      longestDelivery:
        "Bugunku en gec giden sipariş metriginde, sipariş olusumundan teslim/ready anina kadar en uzun sureyi alan sipariş kullanildi.",
      deliveryAverage:
        "Ortalama teslim suresi, order created ile deliveredAt varsa deliveredAt; yoksa readyAt arasindan hesaplandi.",
      preparationAverage:
        "Ortalama hazırlama suresi, preparingStartedAt ile readyAt (yoksa deliveredAt) arasindan hesaplandi.",
      waiterResponseAverage:
        "Garson ilgilenme suresi, waiter call/bill request olusumundan ilk acknowledgedAt (yoksa resolvedAt/settledAt) anina kadar hesaplandi.",
      revenueInclusion: unifiedMetrics.scopeSummary,
    },
  };
}
