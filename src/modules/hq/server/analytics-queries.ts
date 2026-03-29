import type { OrderPaymentStatus, PaymentGatewayProvider, PaymentMethod, Prisma as PrismaNamespace } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { resolveTenantLifecycleSnapshotFromRow } from "@/core/tenancy/lifecycle-policy";
import { calculateUnifiedRevenueMetrics } from "@/lib/report-order-metrics";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";
import { prisma } from "@/lib/prisma";
import { listActivePlans } from "@/modules/hq/server/tenant-queries";
import {
  buildDateRangeKeys,
  buildLast7DaysDateKeys,
  resolveAnalyticsFilters,
} from "@/modules/hq/server/analytics-filters";
import { enrichRowsWithHealth, sortTenantRows } from "@/modules/hq/server/analytics-health";
import { buildAnalyticsInsights } from "@/modules/hq/server/analytics-insights";
import type { HqAnalyticsData } from "@/modules/hq/server/analytics-types";

type CompletedOrderRow = {
  id: number;
  tenantId: number;
  createdAt: Date;
  deliveredAt: Date | null;
  totalPrice: PrismaNamespace.Decimal;
  items: unknown;
  requestedPaymentMethod: PaymentMethod | null;
  paymentStatus: OrderPaymentStatus | null;
  paymentProvider: PaymentGatewayProvider | null;
};

type CancellationRow = {
  tenantId: number;
  createdAt: Date;
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

function ensureArrayMapValue<K extends string | number, T>(map: Map<K, T[]>, key: K): T[] {
  const existing = map.get(key);
  if (existing) return existing;
  const created: T[] = [];
  map.set(key, created);
  return created;
}

function toTenantWhere(
  filters: ReturnType<typeof resolveAnalyticsFilters>,
  effectivePlanCode: string,
): PrismaNamespace.TenantWhereInput {
  return {
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { slug: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(effectivePlanCode ? { plan: { code: effectivePlanCode as never } } : {}),
  };
}

export async function getHqAnalyticsData(searchParams: {
  range?: string;
  from?: string;
  to?: string;
  status?: string;
  plan?: string;
  q?: string;
  sort?: string;
  dir?: string;
}): Promise<HqAnalyticsData> {
  const filters = resolveAnalyticsFilters(searchParams);
  const availablePlans = await listActivePlans();
  const effectivePlanCode = availablePlans.some((plan) => plan.code === filters.planCode)
    ? filters.planCode
    : "";

  const tenantRows = await prisma.tenant.findMany({
      where: toTenantWhere(filters, effectivePlanCode),
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        setupCompleted: true,
        setupProgress: { select: { currentStep: true } },
        plan: { select: { code: true, name: true } },
        _count: { select: { restaurants: true } },
      },
      orderBy: [{ name: "asc" }],
    });

  const tenants = tenantRows
    .map((tenant) => {
      const lifecycle = resolveTenantLifecycleSnapshotFromRow({
        tenantId: tenant.id,
        status: String(tenant.status),
        setupCompleted: tenant.setupCompleted,
        setupStep: tenant.setupProgress?.currentStep ?? null,
      }).normalizedStatus;
      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        lifecycleStatus: lifecycle,
        planCode: String(tenant.plan.code),
        planName: tenant.plan.name,
        setupCompleted: tenant.setupCompleted,
        restaurantsCount: tenant._count.restaurants,
      };
    })
    .filter((tenant) => {
      if (filters.status === "ALL") return true;
      return tenant.lifecycleStatus === filters.status;
    });

  const rangeStart = getTurkeyDayRange(filters.fromDate).startUtc;
  const rangeEndExclusive = getTurkeyDayRange(filters.toDate).endUtc;
  const tenantIds = tenants.map((tenant) => tenant.id);
  const dateKeys = buildDateRangeKeys(filters.fromDate, filters.toDate);

  if (tenantIds.length === 0) {
    return {
      filters,
      availablePlans,
      kpi: {
        totalTenants: 0,
        activeTenants: 0,
        trialTenants: 0,
        totalOrders: 0,
        totalRevenue: 0,
        averageOrdersPerTenant: 0,
        averageRevenuePerTenant: 0,
        zeroOrderTenantCount: 0,
        topRevenueTenantName: null,
        lowestPerformanceTenantName: null,
      },
      tableRows: [],
      trend: dateKeys.map((date) => ({ date, orders: 0, revenue: 0 })),
      insights: [
        {
          id: "empty-tenants",
          title: "Filtreye uygun tenant bulunamadı",
          description: "Filtreyi genişleterek tenant listesini görüntüleyin.",
          tenantRefs: [],
        },
      ],
    };
  }

  const last7DateKeys = buildLast7DaysDateKeys(filters.toDate);
  const last7StartUtc = getTurkeyDayRange(last7DateKeys[0]!).startUtc;
  const last7EndUtc = getTurkeyDayRange(filters.toDate).endUtc;

  const [completedOrdersRaw, paymentsRaw, cancellationsRaw, cashAdjustmentsRaw, lastOrderRows, recent7DayOrders] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: rangeStart, lt: rangeEndExclusive },
          table: { restaurant: { tenantId: { in: tenantIds } } },
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
          table: { select: { restaurant: { select: { tenantId: true } } } },
        },
      }),
      prisma.payment.findMany({
        where: {
          tenantId: { in: tenantIds },
          createdAt: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: { tenantId: true, createdAt: true, amount: true, method: true, gatewayProvider: true },
      }),
      prisma.orderItemCancellation.findMany({
        where: {
          tenantId: { in: tenantIds },
          createdAt: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: {
          tenantId: true,
          createdAt: true,
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
          tenantId: { in: tenantIds },
          createdAt: { gte: rangeStart, lt: rangeEndExclusive },
        },
        select: { tenantId: true, createdAt: true, orderId: true, totalAmountDelta: true },
      }),
      prisma.$queryRaw<Array<{ tenantId: number; lastOrderAt: Date }>>(Prisma.sql`
        SELECT r."tenantId" AS "tenantId", MAX(o."createdAt") AS "lastOrderAt"
        FROM "Order" o
        INNER JOIN "Table" t ON t."id" = o."tableId"
        INNER JOIN "Restaurant" r ON r."id" = t."restaurantId"
        WHERE o."status" = 'COMPLETED'
          AND r."tenantId" IN (${Prisma.join(tenantIds)})
        GROUP BY r."tenantId"
      `),
      prisma.order.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: last7StartUtc, lt: last7EndUtc },
          table: { restaurant: { tenantId: { in: tenantIds } } },
        },
        select: {
          createdAt: true,
          table: { select: { restaurant: { select: { tenantId: true } } } },
        },
      }),
    ]);

  const completedOrders: CompletedOrderRow[] = completedOrdersRaw.map((row) => ({
    id: row.id,
    tenantId: row.table.restaurant.tenantId ?? 0,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
    totalPrice: row.totalPrice,
    items: row.items,
    requestedPaymentMethod: row.requestedPaymentMethod,
    paymentStatus: row.paymentStatus,
    paymentProvider: row.paymentProvider,
  }));

  const cancellations = cancellationsRaw as CancellationRow[];

  const ordersByTenant = new Map<number, ReturnType<typeof mapOrderToRevenueInput>[]>();
  const paymentsByTenant = new Map<number, ReturnType<typeof mapPaymentToRevenueInput>[]>();
  const cancellationsByTenant = new Map<number, ReturnType<typeof mapCancellationToRevenueInput>[]>();
  const adjustmentsByTenant = new Map<number, ReturnType<typeof mapAdjustmentToRevenueInput>[]>();

  const ordersByDay = new Map<string, ReturnType<typeof mapOrderToRevenueInput>[]>();
  const paymentsByDay = new Map<string, ReturnType<typeof mapPaymentToRevenueInput>[]>();
  const cancellationsByDay = new Map<string, ReturnType<typeof mapCancellationToRevenueInput>[]>();
  const adjustmentsByDay = new Map<string, ReturnType<typeof mapAdjustmentToRevenueInput>[]>();

  for (const row of completedOrders) {
    if (!row.tenantId) continue;
    const mapped = mapOrderToRevenueInput(row);
    ensureArrayMapValue(ordersByTenant, row.tenantId).push(mapped);
    const dateKey = getTurkeyDateString(row.createdAt);
    ensureArrayMapValue(ordersByDay, dateKey).push(mapped);
  }

  for (const row of paymentsRaw) {
    const mapped = mapPaymentToRevenueInput(row);
    ensureArrayMapValue(paymentsByTenant, row.tenantId).push(mapped);
    const dateKey = getTurkeyDateString(row.createdAt);
    ensureArrayMapValue(paymentsByDay, dateKey).push(mapped);
  }

  for (const row of cancellations) {
    const mapped = mapCancellationToRevenueInput(row);
    ensureArrayMapValue(cancellationsByTenant, row.tenantId).push(mapped);
    const dateKey = getTurkeyDateString(row.createdAt);
    ensureArrayMapValue(cancellationsByDay, dateKey).push(mapped);
  }

  for (const row of cashAdjustmentsRaw) {
    const mapped = mapAdjustmentToRevenueInput(row);
    ensureArrayMapValue(adjustmentsByTenant, row.tenantId).push(mapped);
    const dateKey = getTurkeyDateString(row.createdAt);
    ensureArrayMapValue(adjustmentsByDay, dateKey).push(mapped);
  }

  const lastOrderMap = new Map(lastOrderRows.map((row) => [row.tenantId, row.lastOrderAt]));

  const trend7Map = new Map<number, number[]>();
  const trend7Seed = new Map<string, number>(last7DateKeys.map((key) => [key, 0]));
  for (const tenantId of tenantIds) {
    trend7Map.set(tenantId, [...trend7Seed.values()]);
  }
  const dateToIndex = new Map(last7DateKeys.map((key, index) => [key, index]));
  for (const row of recent7DayOrders) {
    const tenantId = row.table.restaurant.tenantId ?? 0;
    const dateKey = getTurkeyDateString(row.createdAt);
    const index = dateToIndex.get(dateKey);
    const current = trend7Map.get(tenantId);
    if (index == null || !current) continue;
    current[index] += 1;
  }

  const baseRows = tenants.map((tenant) => {
    const metrics = calculateUnifiedRevenueMetrics({
      completedOrders: ordersByTenant.get(tenant.id) ?? [],
      payments: paymentsByTenant.get(tenant.id) ?? [],
      cancellations: cancellationsByTenant.get(tenant.id) ?? [],
      cashAdjustments: adjustmentsByTenant.get(tenant.id) ?? [],
    });

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      slug: tenant.slug,
      lifecycleStatus: tenant.lifecycleStatus,
      planCode: tenant.planCode,
      planName: tenant.planName,
      restaurantsCount: tenant.restaurantsCount,
      completedOrderCount: metrics.completedOrderCount,
      netRevenue: metrics.netRevenue,
      averageBasket: metrics.averageOrderAmount,
      lastOrderAt: lastOrderMap.get(tenant.id) ?? null,
      trendLast7DaysCounts: trend7Map.get(tenant.id) ?? [0, 0, 0, 0, 0, 0, 0],
    };
  });

  const staleThresholdDate = new Date(rangeEndExclusive.getTime() - 14 * 24 * 60 * 60 * 1000);
  const rowsWithHealth = enrichRowsWithHealth({
    rows: baseRows,
    staleThresholdDate,
  });
  const sortedRows = sortTenantRows(rowsWithHealth, filters.sortBy, filters.sortDirection);

  const totalOrders = sortedRows.reduce((sum, row) => sum + row.completedOrderCount, 0);
  const totalRevenue = sortedRows.reduce((sum, row) => sum + row.netRevenue, 0);
  const topRevenue = [...sortedRows].sort((a, b) => b.netRevenue - a.netRevenue)[0];
  const riskyRows = sortedRows.filter((row) => row.performanceLabel === "riskli");
  const lowest = riskyRows.sort((a, b) => a.netRevenue - b.netRevenue)[0] ?? sortedRows[sortedRows.length - 1];

  const trend = dateKeys.map((date) => {
    const metrics = calculateUnifiedRevenueMetrics({
      completedOrders: ordersByDay.get(date) ?? [],
      payments: paymentsByDay.get(date) ?? [],
      cancellations: cancellationsByDay.get(date) ?? [],
      cashAdjustments: adjustmentsByDay.get(date) ?? [],
    });
    return {
      date,
      orders: metrics.completedOrderCount,
      revenue: metrics.netRevenue,
    };
  });

  return {
    filters,
    availablePlans,
    kpi: {
      totalTenants: sortedRows.length,
      activeTenants: sortedRows.filter((row) => row.lifecycleStatus === "ACTIVE").length,
      trialTenants: sortedRows.filter((row) => row.lifecycleStatus === "TRIAL").length,
      totalOrders,
      totalRevenue,
      averageOrdersPerTenant: sortedRows.length > 0 ? totalOrders / sortedRows.length : 0,
      averageRevenuePerTenant: sortedRows.length > 0 ? totalRevenue / sortedRows.length : 0,
      zeroOrderTenantCount: sortedRows.filter((row) => row.completedOrderCount === 0).length,
      topRevenueTenantName: topRevenue?.netRevenue > 0 ? topRevenue.tenantName : null,
      lowestPerformanceTenantName: lowest?.tenantName ?? null,
    },
    tableRows: sortedRows,
    trend,
    insights: buildAnalyticsInsights({
      rows: sortedRows,
      setupSignals: tenants.map((tenant) => ({
        tenantId: tenant.id,
        setupCompleted: tenant.setupCompleted,
        restaurantsCount: tenant.restaurantsCount,
      })),
      startDate: rangeStart,
      endDate: rangeEndExclusive,
    }),
  };
}

function mapOrderToRevenueInput(order: CompletedOrderRow) {
  return {
    id: order.id,
    status: "COMPLETED" as const,
    deliveredAt: order.deliveredAt,
    totalPrice: order.totalPrice,
    items: order.items,
    requestedPaymentMethod: order.requestedPaymentMethod,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
  };
}

function mapPaymentToRevenueInput(payment: {
  amount: PrismaNamespace.Decimal;
  method: PaymentMethod;
  gatewayProvider: PaymentGatewayProvider | null;
}) {
  return {
    amount: payment.amount,
    method: payment.method,
    gatewayProvider: payment.gatewayProvider,
  };
}

function mapCancellationToRevenueInput(cancellation: CancellationRow) {
  return {
    orderId: cancellation.orderId,
    productId: cancellation.productId,
    quantity: cancellation.quantity,
    customReason: cancellation.customReason,
    order: {
      status: cancellation.order.status,
      deliveredAt: cancellation.order.deliveredAt,
      requestedPaymentMethod: cancellation.order.requestedPaymentMethod,
      paymentStatus: cancellation.order.paymentStatus,
      paymentProvider: cancellation.order.paymentProvider,
      items: cancellation.order.items,
    },
  };
}

function mapAdjustmentToRevenueInput(row: { orderId: number; totalAmountDelta: PrismaNamespace.Decimal }) {
  return {
    orderId: row.orderId,
    totalAmountDelta: row.totalAmountDelta,
  };
}
