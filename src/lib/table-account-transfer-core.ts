import { Prisma } from "@prisma/client";
import type { OrderPaymentStatus, PaymentGatewayProvider, PaymentMethod, Prisma as PrismaNs } from "@prisma/client";
import {
  buildOptionRowsFromOrderLines,
  parseOrderLinesJson,
  roundCurrency,
  sumOrderLinesTotal,
  type OrderLineJson,
} from "@/lib/order-items-json";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { isOrderAwaitingOnlinePayment, isOrderPaidViaIyzico } from "@/lib/order-payment-visibility";
import { prisma } from "@/lib/prisma";

type Tx = PrismaNs.TransactionClient;

export type TransferKind = "FULL" | "MERGE" | "PARTIAL_LINES";

export async function assertTablesSameRestaurant(
  tx: Tx,
  tenantId: number,
  tableIds: number[],
): Promise<{ ok: true; tables: { id: number; tableNo: number; isActive: boolean; restaurantId: number }[] } | { ok: false; message: string }> {
  const unique = [...new Set(tableIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (unique.length === 0) {
    return { ok: false, message: "Gecerli masa secilmedi." };
  }
  const tables = await tx.table.findMany({
    where: {
      id: { in: unique },
      restaurant: { tenantId },
    },
    select: { id: true, tableNo: true, isActive: true, restaurantId: true },
  });
  if (tables.length !== unique.length) {
    return { ok: false, message: "Bir veya daha fazla masa bulunamadi." };
  }
  const rid = tables[0]!.restaurantId;
  if (tables.some((t) => t.restaurantId !== rid)) {
    return { ok: false, message: "Masalar ayni subeye ait olmalidir." };
  }
  return { ok: true, tables };
}

export async function tableHasOperationalContent(
  tx: Tx,
  tenantId: number,
  tableId: number,
): Promise<boolean> {
  const [orderCount, billCount, callCount] = await Promise.all([
    tx.order.count({
      where: {
        tableId,
        table: { restaurant: { tenantId } },
        status: { not: "REJECTED" },
      },
    }),
    tx.billRequest.count({
      where: {
        tenantId,
        tableId,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    }),
    tx.waiterCall.count({
      where: {
        tenantId,
        tableId,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    }),
  ]);
  return orderCount > 0 || billCount > 0 || callCount > 0;
}

async function lockOrdersByIds(tx: Tx, orderIds: number[]) {
  const sorted = [...new Set(orderIds)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  for (const id of sorted) {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${id} FOR UPDATE`;
  }
}

async function lockOrdersForTables(tx: Tx, tenantId: number, tableIds: number[]) {
  const orders = await tx.order.findMany({
    where: {
      tableId: { in: tableIds },
      table: { restaurant: { tenantId } },
    },
    select: { id: true },
  });
  await lockOrdersByIds(
    tx,
    orders.map((o) => o.id),
  );
}

async function consolidateOpenBillRequests(tx: Tx, tenantId: number, tableId: number) {
  const open = await tx.billRequest.findMany({
    where: {
      tenantId,
      tableId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
    include: {
      paymentIntents: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (open.length <= 1) return;

  const keep =
    open.find((b) => b.paymentIntents.length > 0) ??
    open.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]!;

  for (const br of open) {
    if (br.id === keep.id) continue;
    if (br.paymentIntents.length > 0) continue;
    await tx.billRequest.update({
      where: { id: br.id },
      data: { status: "CANCELED" },
    });
  }
}

async function moveTableScopedRows(
  tx: Tx,
  tenantId: number,
  fromTableIds: number[],
  toTableId: number,
) {
  const now = new Date();
  const destSession = await tx.tableSession.findFirst({
    where: {
      tenantId,
      tableId: toTableId,
      isActive: true,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  await tx.order.updateMany({
    where: {
      tableId: { in: fromTableIds },
      table: { restaurant: { tenantId } },
    },
    data: { tableId: toTableId },
  });

  await tx.payment.updateMany({
    where: { tenantId, tableId: { in: fromTableIds } },
    data: { tableId: toTableId },
  });

  await tx.billRequest.updateMany({
    where: {
      tenantId,
      tableId: { in: fromTableIds },
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
    data: {
      tableId: toTableId,
      tableSessionId: destSession?.id ?? null,
    },
  });

  await tx.waiterCall.updateMany({
    where: {
      tenantId,
      tableId: { in: fromTableIds },
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
    data: { tableId: toTableId },
  });
}

export async function deactivateTableSessionsTx(tx: Tx, tenantId: number, tableId: number) {
  await tx.tableSession.updateMany({
    where: { tenantId, tableId, isActive: true },
    data: { isActive: false },
  });
}

async function maybeCloseEmptyTableTx(tx: Tx, tenantId: number, tableId: number) {
  const hasContent = await tableHasOperationalContent(tx, tenantId, tableId);
  if (!hasContent) {
    await tx.table.updateMany({
      where: { id: tableId, restaurant: { tenantId } },
      data: { isActive: false },
    });
  }
}

async function ensureTargetTableOpenTx(tx: Tx, tenantId: number, tableId: number) {
  await tx.table.updateMany({
    where: { id: tableId, restaurant: { tenantId } },
    data: { isActive: true },
  });
}

export async function runFullTableTransferTx(
  tx: Tx,
  params: {
    tenantId: number;
    sourceTableId: number;
    targetTableId: number;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tenantId, sourceTableId, targetTableId } = params;
  if (sourceTableId === targetTableId) {
    return { ok: false, message: "Kaynak ve hedef masa ayni olamaz." };
  }

  const tcheck = await assertTablesSameRestaurant(tx, tenantId, [sourceTableId, targetTableId]);
  if (!tcheck.ok) return { ok: false, message: tcheck.message };

  const sourceHas = await tableHasOperationalContent(tx, tenantId, sourceTableId);
  if (!sourceHas) {
    return { ok: false, message: "Kaynak masada tasinacak acik hesap yok." };
  }

  await lockOrdersForTables(tx, tenantId, [sourceTableId, targetTableId]);

  await moveTableScopedRows(tx, tenantId, [sourceTableId], targetTableId);
  await consolidateOpenBillRequests(tx, tenantId, targetTableId);
  await ensureTargetTableOpenTx(tx, tenantId, targetTableId);
  await deactivateTableSessionsTx(tx, tenantId, sourceTableId);
  await maybeCloseEmptyTableTx(tx, tenantId, sourceTableId);

  return { ok: true };
}

export async function runMergeTablesTx(
  tx: Tx,
  params: {
    tenantId: number;
    sourceTableIds: number[];
    targetTableId: number;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { tenantId, sourceTableIds, targetTableId } = params;
  const sources = [...new Set(sourceTableIds)].filter((id) => id !== targetTableId);
  if (sources.length === 0) {
    return { ok: false, message: "En az bir kaynak masa secin." };
  }

  const tcheck = await assertTablesSameRestaurant(tx, tenantId, [...sources, targetTableId]);
  if (!tcheck.ok) return { ok: false, message: tcheck.message };

  for (const sid of sources) {
    const has = await tableHasOperationalContent(tx, tenantId, sid);
    if (!has) {
      return { ok: false, message: `Masa ${tcheck.tables.find((t) => t.id === sid)?.tableNo ?? sid} icin acik hesap yok.` };
    }
  }

  await lockOrdersForTables(tx, tenantId, [...sources, targetTableId]);

  await moveTableScopedRows(tx, tenantId, sources, targetTableId);
  await consolidateOpenBillRequests(tx, tenantId, targetTableId);
  await ensureTargetTableOpenTx(tx, tenantId, targetTableId);

  for (const sid of sources) {
    await deactivateTableSessionsTx(tx, tenantId, sid);
    await maybeCloseEmptyTableTx(tx, tenantId, sid);
  }

  return { ok: true };
}

/** Sync checks only (DB cancellation/adjustment counts checked separately). */
export function evaluateOrderPartialTransferEligibility(order: {
  status: string;
  paymentStatus: OrderPaymentStatus | null;
  requestedPaymentMethod: PaymentMethod | null;
  paymentProvider: PaymentGatewayProvider | null;
  refundStatus: string;
}): { ok: true } | { ok: false; message: string } {
  if (order.refundStatus === "REFUNDED") {
    return { ok: false, message: "Iade edilmis sipariş satirlari tasinamaz." };
  }
  if (order.status === "PENDING_WAITER_APPROVAL") {
    return { ok: false, message: "Once garson onayini tamamlayin." };
  }
  if (order.status === "COMPLETED" || order.status === "REJECTED") {
    return { ok: false, message: "Bu sipariş durumunda kalem tasinamaz." };
  }
  if (order.status !== "PENDING" && order.status !== "PREPARING") {
    return { ok: false, message: "Bu sipariş durumunda kalem tasinamaz." };
  }
  if (isOrderAwaitingOnlinePayment(order)) {
    return { ok: false, message: "Online odeme bekleyen sipariş bolunemez." };
  }
  if (isOrderPaidViaIyzico(order)) {
    return { ok: false, message: "Online odemesi tamamlanan sipariş bolunemez." };
  }
  if (order.paymentStatus === "INITIATED") {
    return { ok: false, message: "Kismi odeme alinmis siparişte kalem tasinamaz." };
  }
  if (order.paymentStatus === "PAID") {
    return { ok: false, message: "Odeme tamamlanmis sipariş bolunemez." };
  }
  return { ok: true };
}

async function replaceOrderItemOptions(tx: Tx, orderId: number, items: unknown) {
  await tx.orderItemOption.deleteMany({ where: { orderId } });
  const lines = parseOrderLinesJson(items);
  const rows = buildOptionRowsFromOrderLines(lines);
  if (rows.length > 0) {
    await tx.orderItemOption.createMany({ data: rows.map((r) => ({ ...r, orderId })) });
  }
}

export async function runPartialLineTransferTx(
  tx: Tx,
  params: {
    tenantId: number;
    sourceTableId: number;
    targetTableId: number;
    orderId: number;
    lineIndexes: number[];
  },
): Promise<{ ok: true; newOrderId: number } | { ok: false; message: string }> {
  const { tenantId, sourceTableId, targetTableId, orderId, lineIndexes } = params;
  if (sourceTableId === targetTableId) {
    return { ok: false, message: "Kaynak ve hedef masa ayni olamaz." };
  }

  const tcheck = await assertTablesSameRestaurant(tx, tenantId, [sourceTableId, targetTableId]);
  if (!tcheck.ok) return { ok: false, message: tcheck.message };

  const idxSet = [...new Set(lineIndexes)].filter((i) => Number.isInteger(i) && i >= 0);
  if (idxSet.length === 0) {
    return { ok: false, message: "En az bir satir secin." };
  }

  await lockOrdersForTables(tx, tenantId, [sourceTableId, targetTableId]);

  const order = await tx.order.findFirst({
    where: {
      id: orderId,
      tableId: sourceTableId,
      table: { restaurant: { tenantId } },
    },
  });

  if (!order) {
    return { ok: false, message: "Sipariş bulunamadi veya masa eslesmiyor." };
  }

  const allow = evaluateOrderPartialTransferEligibility(order);
  if (!allow.ok) return { ok: false, message: allow.message };

  const [cancelCount, adjCount] = await Promise.all([
    tx.orderItemCancellation.count({ where: { tenantId, orderId } }),
    tx.cashOrderAdjustment.count({ where: { tenantId, orderId } }),
  ]);
  if (cancelCount > 0 || adjCount > 0) {
    return {
      ok: false,
      message: "Iptal veya kasa duzeltmesi olan siparişlerde kalem tasinamaz.",
    };
  }

  const lines = parseOrderLinesJson(order.items);
  if (lines.length === 0) {
    return { ok: false, message: "Sipariş satirlari okunamadi." };
  }

  for (const i of idxSet) {
    if (i >= lines.length) {
      return { ok: false, message: "Gecersiz satir secimi." };
    }
  }

  if (idxSet.length === lines.length) {
    return { ok: false, message: "Tum satirlari tasimak icin Hesabi Tasiyin." };
  }

  const moved: OrderLineJson[] = [];
  const kept: OrderLineJson[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (idxSet.includes(i)) moved.push(lines[i]!);
    else kept.push(lines[i]!);
  }

  const movedTotal = sumOrderLinesTotal(moved);
  const keptTotal = sumOrderLinesTotal(kept);
  if (moved.length === 0 || movedTotal <= 0) {
    return { ok: false, message: "Tasinacak satir yok." };
  }

  const newOrder = await tx.order.create({
    data: {
      tableId: targetTableId,
      items: moved as unknown as Prisma.InputJsonValue,
      totalPrice: movedTotal,
      status: order.status,
      note: order.note,
      requestedPaymentMethod: order.requestedPaymentMethod,
      paymentStatus: order.paymentStatus,
      paymentProvider: order.paymentProvider,
      refundStatus: order.refundStatus,
      isRiskFlagged: order.isRiskFlagged,
      riskScore: order.riskScore,
      riskLevel: order.riskLevel,
      riskReasons:
        order.riskReasons === null || order.riskReasons === undefined
          ? Prisma.JsonNull
          : (order.riskReasons as Prisma.InputJsonValue),
      preparingStartedAt: order.preparingStartedAt,
      readyAt: order.readyAt,
      deliveredAt: null,
      deliveredByStaffId: null,
    },
  });

  await replaceOrderItemOptions(tx, newOrder.id, moved);

  await tx.order.update({
    where: { id: order.id },
    data: {
      items: kept as unknown as Prisma.InputJsonValue,
      totalPrice: keptTotal,
    },
  });
  await replaceOrderItemOptions(tx, order.id, kept);

  await consolidateOpenBillRequests(tx, tenantId, targetTableId);
  await ensureTargetTableOpenTx(tx, tenantId, targetTableId);
  await deactivateTableSessionsTx(tx, tenantId, sourceTableId);

  return { ok: true, newOrderId: newOrder.id };
}

export async function getTransferPreviewForTable(params: {
  tenantId: number;
  tableId: number;
}): Promise<{
  tableNo: number;
  isActive: boolean;
  hasOpenAccount: boolean;
  remainingAmount: number;
  orderCount: number;
  billSnippet: string;
}> {
  const { tenantId, tableId } = params;
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurant: { tenantId } },
    select: { tableNo: true, isActive: true },
  });
  if (!table) {
    return {
      tableNo: 0,
      isActive: false,
      hasOpenAccount: false,
      remainingAmount: 0,
      orderCount: 0,
      billSnippet: "",
    };
  }

  const snap = await getTableBillingSnapshot({ tenantId, tableId });
  const orderCount = await prisma.order.count({
    where: {
      tableId,
      table: { restaurant: { tenantId } },
      status: { not: "REJECTED" },
    },
  });
  const hasOpenAccount =
    orderCount > 0 ||
    snap.totalUnpaid > 0.009 ||
    (await prisma.billRequest.count({
      where: { tenantId, tableId, status: { in: ["PENDING", "ACKNOWLEDGED"] } },
    })) > 0;

  return {
    tableNo: table.tableNo,
    isActive: table.isActive,
    hasOpenAccount,
    remainingAmount: roundCurrency(snap.remainingAmount),
    orderCount,
    billSnippet: `Kalan: ${roundCurrency(snap.totalUnpaid)} TL`,
  };
}
