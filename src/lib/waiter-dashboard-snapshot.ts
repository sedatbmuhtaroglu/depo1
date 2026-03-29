import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getIyzicoEnabledForTenant } from "@/lib/iyzico-config";
import {
  resolvePaymentSettledState,
  STAFF_VISIBLE_ORDER_FILTER,
} from "@/lib/order-payment-visibility";
import { getTableBillingSnapshot } from "@/lib/table-billing";

type StoredOrderItem = {
  productId: number;
  quantity: number;
  price: number;
};

export type CancellationSnapshot = {
  orderId: number;
  productId: number;
  quantity: number;
};

export type CashAdjustmentSnapshot = {
  orderId: number;
  productId: number;
  adjustedQuantity: number;
  actionType: "PARTIAL_CANCEL" | "PARTIAL_RETURN";
};

/** JSON-serializable waiter dashboard payload (ISO date strings). */
export type WaiterDashboardSnapshotJson = {
  iyzicoEnabled: boolean;
  myMetrics: {
    ordersDelivered: number;
    callResponseAvgMinutes: number | null;
    billResponseAvgMinutes: number | null;
  } | null;
  tables: { id: number; tableNo: number; isActive: boolean }[];
  tableRows: {
    id: number;
    tableNo: number;
    isActive: boolean;
    hasActiveOrders: boolean;
    lastOrder:
      | {
          status: string;
          createdAt: string;
          totalPrice: string;
          id: number;
        }
      | undefined;
  }[];
  tableSummaries: {
    tableId: number;
    tableNo: number;
    totalAmount: number;
    totalFromOrders: number;
    grossPaidAmount: number;
    refundedAmount: number;
    netPaidAmount: number;
    remainingAmount: number;
    overpaidAmount: number;
    paid: number;
    unpaid: number;
  }[];
  productsWithPrice: {
    id: number;
    nameTR: string;
    price: number;
    categoryId: number;
  }[];
  categories: { id: number; nameTR: string }[];
  waiterCalls: {
    id: number;
    table: { tableNo: number };
    status: string;
    createdAt: string;
  }[];
  billRequests: {
    id: number;
    table: { tableNo: number };
    status: string;
    createdAt: string;
  }[];
  pendingApprovalOrders: ReturnType<typeof serializeCleanOrder>[];
  activeOrders: ReturnType<typeof serializeCleanOrder>[];
  completedOrders: ReturnType<typeof serializeCleanOrder>[];
  rejectedOrders: ReturnType<typeof serializeCleanOrder>[];
  readyForPickup: ReturnType<typeof serializeCleanOrder>[];
  cancellations: CancellationSnapshot[];
  cashAdjustments: CashAdjustmentSnapshot[];
};

type CleanOrder = {
  paymentSettled: boolean;
  id: number;
  table: { tableNo: number };
  items: {
    productId: number;
    quantity: number;
    price: number;
    productName: string;
  }[];
  totalPrice: string;
  status: string;
  createdAt: Date;
  preparingStartedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  requestedPaymentMethod: string | null;
  paymentStatus: string | null;
  paymentProvider: string | null;
};

function serializeCleanOrder(order: CleanOrder) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    preparingStartedAt: order.preparingStartedAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

export type SerializedCleanOrder = ReturnType<typeof serializeCleanOrder>;

export async function loadWaiterDashboardSnapshot(params: {
  tenantId: number;
  staffId: number | null;
}): Promise<WaiterDashboardSnapshotJson> {
  const { tenantId, staffId } = params;
  const supportsProductStockFields =
    prismaModelHasField("Product", "trackStock") &&
    prismaModelHasField("Product", "stockQuantity");

  const [tables, orders, products, waiterCalls, billRequests, categories, myMetrics] =
    await Promise.all([
      prisma.table.findMany({
        where: {
          restaurant: {
            tenantId,
          },
        },
        include: {
          restaurant: true,
        },
        orderBy: { tableNo: "asc" },
      }),
      prisma.order.findMany({
        where: {
          table: {
            restaurant: {
              tenantId,
            },
          },
          AND: [STAFF_VISIBLE_ORDER_FILTER],
        },
        include: {
          table: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
      }),
      prisma.product.findMany({
        where: {
          category: { restaurant: { tenantId } },
          isAvailable: true,
          ...(supportsProductStockFields
            ? {
                OR: [{ trackStock: false }, { stockQuantity: { gt: 0 } }],
              }
            : {}),
        },
        select: { id: true, nameTR: true, price: true, categoryId: true },
      }),
      prisma.waiterCall.findMany({
        where: {
          tenantId,
        },
        include: {
          table: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
      }),
      prisma.billRequest.findMany({
        where: {
          tenantId,
        },
        include: {
          table: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
      }),
      prisma.category.findMany({
        where: { restaurant: { tenantId } },
        select: { id: true, nameTR: true },
        orderBy: { id: "asc" },
      }),
      staffId != null
        ? (async () => {
            const from = new Date();
            from.setDate(from.getDate() - 7);
            from.setHours(0, 0, 0, 0);
            const to = new Date();
            const [ordersDelivered, calls, bills] = await Promise.all([
              prisma.order.count({
                where: {
                  table: { restaurant: { tenantId } },
                  status: "COMPLETED",
                  deliveredByStaffId: staffId,
                  deliveredAt: { gte: from, lte: to },
                },
              }),
              prisma.waiterCall.findMany({
                where: {
                  tenantId,
                  acknowledgedByStaffId: staffId,
                  acknowledgedAt: { not: null },
                  createdAt: { gte: from, lte: to },
                },
                select: { createdAt: true, acknowledgedAt: true },
              }),
              prisma.billRequest.findMany({
                where: {
                  tenantId,
                  acknowledgedByStaffId: staffId,
                  acknowledgedAt: { not: null },
                  createdAt: { gte: from, lte: to },
                },
                select: { createdAt: true, acknowledgedAt: true },
              }),
            ]);
            const callMins =
              calls.length > 0
                ? Math.round(
                    calls.reduce(
                      (s, c) => s + (c.acknowledgedAt!.getTime() - c.createdAt.getTime()),
                      0,
                    ) /
                      calls.length /
                      60000,
                  )
                : null;
            const billMins =
              bills.length > 0
                ? Math.round(
                    bills.reduce(
                      (s, b) => s + (b.acknowledgedAt!.getTime() - b.createdAt.getTime()),
                      0,
                    ) /
                      bills.length /
                      60000,
                  )
                : null;
            return {
              ordersDelivered,
              callResponseAvgMinutes: callMins,
              billResponseAvgMinutes: billMins,
            };
          })()
        : Promise.resolve(null),
    ]);

  const orderIds = orders.map((o) => o.id);
  const cancellations =
    orderIds.length > 0
      ? await prisma.orderItemCancellation.findMany({
          where: { tenantId, orderId: { in: orderIds } },
        })
      : [];
  const cancellationSnapshots: CancellationSnapshot[] = cancellations.map((c) => ({
    orderId: c.orderId,
    productId: c.productId,
    quantity: c.quantity,
  }));
  const cashAdjustments: CashAdjustmentSnapshot[] =
    orderIds.length > 0
      ? await prisma.cashOrderAdjustment.findMany({
          where: { tenantId, orderId: { in: orderIds } },
          select: {
            orderId: true,
            productId: true,
            adjustedQuantity: true,
            actionType: true,
          },
        })
      : [];
  const cancellationQuantityMap = new Map<string, number>();
  for (const cancellation of cancellationSnapshots) {
    const key = `${cancellation.orderId}:${cancellation.productId}`;
    cancellationQuantityMap.set(
      key,
      (cancellationQuantityMap.get(key) ?? 0) + cancellation.quantity,
    );
  }
  const cashAdjustmentQuantityMap = new Map<string, number>();
  for (const adjustment of cashAdjustments) {
    const key = `${adjustment.orderId}:${adjustment.productId}`;
    cashAdjustmentQuantityMap.set(
      key,
      (cashAdjustmentQuantityMap.get(key) ?? 0) + adjustment.adjustedQuantity,
    );
  }

  const tableSummaries = await Promise.all(
    tables.map(async (table) => {
      const snapshot = await getTableBillingSnapshot({
        tenantId,
        tableId: table.id,
      });
      return {
        tableId: table.id,
        tableNo: table.tableNo,
        totalAmount: snapshot.totalAmount,
        totalFromOrders: snapshot.totalFromOrders,
        grossPaidAmount: snapshot.grossPaidAmount,
        refundedAmount: snapshot.refundedAmount,
        netPaidAmount: snapshot.netPaidAmount,
        remainingAmount: snapshot.remainingAmount,
        overpaidAmount: snapshot.overpaidAmount,
        paid: snapshot.netPaidAmount,
        unpaid: snapshot.totalUnpaid,
      };
    }),
  );

  const productMap = products.reduce((acc, current) => {
    acc[current.id] = current.nameTR;
    return acc;
  }, {} as Record<number, string>);

  const productsWithPrice = products.map((p) => ({
    id: p.id,
    nameTR: p.nameTR,
    price: Number(p.price),
    categoryId: p.categoryId,
  }));
  const tableSummaryById = new Map(tableSummaries.map((summary) => [summary.tableId, summary]));

  const cleanOrders: CleanOrder[] = orders.map((order) => ({
    paymentSettled: resolvePaymentSettledState({
      paymentStatus: order.paymentStatus,
      deliveredAt: order.deliveredAt,
      totalUnpaid: tableSummaryById.get(order.tableId)?.unpaid ?? null,
      totalPaid: tableSummaryById.get(order.tableId)?.paid ?? null,
      totalFromOrders: tableSummaryById.get(order.tableId)?.totalFromOrders ?? null,
    }),
    id: order.id,
    table: { tableNo: order.table.tableNo },
    items: (order.items as StoredOrderItem[]).map((item) => ({
      ...item,
      productName: productMap[item.productId] || "Silinmiş / Bilinmeyen Ürün",
    })),
    totalPrice: order.totalPrice.toString(),
    status: order.status,
    createdAt: order.createdAt,
    preparingStartedAt: order.preparingStartedAt,
    readyAt: order.readyAt,
    deliveredAt: order.deliveredAt,
    requestedPaymentMethod: order.requestedPaymentMethod,
    paymentStatus: order.paymentStatus,
    paymentProvider: order.paymentProvider,
  }));

  const rawPendingApprovalOrders = cleanOrders.filter(
    (order) => order.status === "PENDING_WAITER_APPROVAL",
  );
  const pendingApprovalOrders = rawPendingApprovalOrders
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => {
        const key = `${order.id}:${item.productId}`;
        const cancelledQty = cancellationQuantityMap.get(key) ?? 0;
        const adjustedQty = cashAdjustmentQuantityMap.get(key) ?? 0;
        return Math.max(0, item.quantity - cancelledQty - adjustedQty) > 0;
      }),
    }))
    .filter((order) => order.items.length > 0);

  const activeOrderStatuses = ["PENDING", "PREPARING"];
  const activeOrders = cleanOrders.filter((order) =>
    activeOrderStatuses.includes(order.status),
  );

  const completedOrders = cleanOrders.filter((order) => order.status === "COMPLETED");

  const readyForPickup = completedOrders.filter(
    (o) => o.readyAt != null && o.deliveredAt == null,
  );

  const rejectedOrders = cleanOrders.filter((order) => order.status === "REJECTED");

  const tableLastOrderMap = new Map<
    number,
    {
      status: string;
      createdAt: Date;
      totalPrice: string;
      id: number;
    }
  >();

  for (const order of orders) {
    const existing = tableLastOrderMap.get(order.tableId);
    if (!existing || order.createdAt > existing.createdAt) {
      tableLastOrderMap.set(order.tableId, {
        status: order.status,
        createdAt: order.createdAt,
        totalPrice: order.totalPrice.toString(),
        id: order.id,
      });
    }
  }

  const activeOrderTableIds = new Set(
    orders
      .filter((o) =>
        ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING"].includes(o.status),
      )
      .map((o) => o.tableId),
  );

  const tableRows = tables.map((t) => ({
    id: t.id,
    tableNo: t.tableNo,
    isActive: t.isActive,
    hasActiveOrders: activeOrderTableIds.has(t.id),
    lastOrder: tableLastOrderMap.get(t.id),
  }));

  const iyzicoEnabled = await getIyzicoEnabledForTenant(tenantId);

  return {
    iyzicoEnabled,
    myMetrics,
    tables: tables.map((t) => ({ id: t.id, tableNo: t.tableNo, isActive: t.isActive })),
    tableRows: tableRows.map((row) => ({
      ...row,
      lastOrder: row.lastOrder
        ? {
            ...row.lastOrder,
            createdAt: row.lastOrder.createdAt.toISOString(),
          }
        : undefined,
    })),
    tableSummaries,
    productsWithPrice,
    categories,
    waiterCalls: waiterCalls.map((call) => ({
      id: call.id,
      table: { tableNo: call.table.tableNo },
      status: call.status,
      createdAt: call.createdAt.toISOString(),
    })),
    billRequests: billRequests.map((request) => ({
      id: request.id,
      table: { tableNo: request.table.tableNo },
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
    pendingApprovalOrders: pendingApprovalOrders.map(serializeCleanOrder),
    activeOrders: activeOrders.map(serializeCleanOrder),
    completedOrders: completedOrders.map(serializeCleanOrder),
    rejectedOrders: rejectedOrders.map(serializeCleanOrder),
    readyForPickup: readyForPickup.map(serializeCleanOrder),
    cancellations: cancellationSnapshots,
    cashAdjustments,
  };
}
