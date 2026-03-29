"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";
import {
  evaluateOrderPartialTransferEligibility,
  getTransferPreviewForTable,
  runFullTableTransferTx,
  runMergeTablesTx,
  runPartialLineTransferTx,
} from "@/lib/table-account-transfer-core";
import { parseOrderLinesJson, roundCurrency } from "@/lib/order-items-json";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

function revalidateTransferSurfaces() {
  revalidatePath("/waiter");
  revalidatePath("/kitchen");
  revalidatePath("/restaurant");
  revalidatePath("/restaurant/orders");
  revalidatePath("/restaurant/reports");
  revalidatePath("/restaurant/tables");
}

function buildAuditActor(params: {
  username: string;
  staffId: number | null;
  role: string;
}): Parameters<typeof writeAuditLog>[0]["actor"] {
  const { username, staffId, role } = params;
  if (staffId != null) {
    return { type: "staff", id: staffId, role };
  }
  return { type: "admin", id: username };
}

async function ensureCashOperationsFeature(tenantId: number) {
  return ensureTenantFeatureEnabled(tenantId, "CASH_OPERATIONS");
}

export async function getTableTransferContext(sourceTableId: number) {
  try {
    const { tenantId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false as const, message: "Yetkisiz." };
    }
    const featureGate = await ensureCashOperationsFeature(tenantId);
    if (!featureGate.ok) {
      return { success: false as const, message: featureGate.message };
    }

    const sid = Math.floor(Number(sourceTableId));
    if (!Number.isInteger(sid) || sid <= 0) {
      return { success: false as const, message: "Gecerli masa seciniz." };
    }

    const preview = await getTransferPreviewForTable({ tenantId, tableId: sid });
    if (!preview.tableNo) {
      return { success: false as const, message: "Masa bulunamadi." };
    }
    if (!preview.hasOpenAccount) {
      return { success: false as const, message: "Bu masada tasinacak acik hesap yok." };
    }

    const ordersRaw = await prisma.order.findMany({
      where: {
        tableId: sid,
        table: { restaurant: { tenantId } },
        status: { not: "REJECTED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        items: true,
        note: true,
        totalPrice: true,
        paymentStatus: true,
        requestedPaymentMethod: true,
        paymentProvider: true,
        refundStatus: true,
      },
    });

    const orderIds = ordersRaw.map((o) => o.id);
    const [cancelRows, adjRows] = await Promise.all([
      orderIds.length > 0
        ? prisma.orderItemCancellation.findMany({
            where: { tenantId, orderId: { in: orderIds } },
            select: { orderId: true },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? prisma.cashOrderAdjustment.findMany({
            where: { tenantId, orderId: { in: orderIds } },
            select: { orderId: true },
          })
        : Promise.resolve([]),
    ]);
    const cancelOrderIds = new Set(cancelRows.map((r) => r.orderId));
    const adjOrderIds = new Set(adjRows.map((r) => r.orderId));

    const productIdSet = new Set<number>();
    for (const o of ordersRaw) {
      for (const line of parseOrderLinesJson(o.items)) {
        productIdSet.add(line.productId);
      }
    }
    const products = await prisma.product.findMany({
      where: { id: { in: [...productIdSet] } },
      select: { id: true, nameTR: true },
    });
    const productName = new Map(products.map((p) => [p.id, p.nameTR]));

    const orders = ordersRaw.map((o) => {
      const lines = parseOrderLinesJson(o.items);
      const eligibility = evaluateOrderPartialTransferEligibility(o);
      const hasFinAdj = cancelOrderIds.has(o.id) || adjOrderIds.has(o.id);
      const partialAllowed =
        eligibility.ok &&
        !hasFinAdj &&
        lines.length > 1;

      return {
        id: o.id,
        status: o.status,
        note: o.note,
        totalPrice: Number(o.totalPrice),
        partialAllowed,
        partialBlockReason: !eligibility.ok
          ? eligibility.message
          : hasFinAdj
            ? "Iptal veya kasa duzeltmesi var"
            : lines.length <= 1
              ? "Tek satirli siparişlerde kalem tasinamaz"
              : null,
        lineRows: lines.map((line, lineIndex) => ({
          lineIndex,
          productId: line.productId,
          productName: productName.get(line.productId) ?? "Urun",
          quantity: line.quantity,
          unitPrice: line.price,
          lineTotal: roundCurrency(line.price * line.quantity),
        })),
      };
    });

    return {
      success: true as const,
      preview,
      orders,
    };
  } catch (e) {
    logServerError("getTableTransferContext", e);
    return { success: false as const, message: "Masa bilgileri alinamadi." };
  }
}

export async function transferTableAccountFull(input: {
  sourceTableId: number;
  targetTableId: number;
}) {
  try {
    const { username, tenantId, staffId, role } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false as const, message: "Yetkisiz." };
    }
    const featureGate = await ensureCashOperationsFeature(tenantId);
    if (!featureGate.ok) {
      return { success: false as const, message: featureGate.message };
    }

    const sourceTableId = Math.floor(Number(input.sourceTableId));
    const targetTableId = Math.floor(Number(input.targetTableId));
    if (!Number.isInteger(sourceTableId) || !Number.isInteger(targetTableId)) {
      return { success: false as const, message: "Gecerli masa seciniz." };
    }

    const sourcePrev = await getTransferPreviewForTable({ tenantId, tableId: sourceTableId });
    const targetPrev = await getTransferPreviewForTable({ tenantId, tableId: targetTableId });

    const result = await prisma.$transaction(
      async (tx) => runFullTableTransferTx(tx, { tenantId, sourceTableId, targetTableId }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    if (!result.ok) {
      return { success: false as const, message: result.message };
    }

    await writeAuditLog({
      tenantId,
      actor: buildAuditActor({ username, staffId, role }),
      actionType: "TABLE_ACCOUNT_TRANSFER_FULL",
      entityType: "Table",
      entityId: String(targetTableId),
      description: `Tam hesap tasima: Masa ${sourcePrev.tableNo} -> Masa ${targetPrev.tableNo}. Kaynak kalan tutar ozeti: ${sourcePrev.billSnippet}. Hedef ozet: ${targetPrev.billSnippet}.`,
    });

    revalidateTransferSurfaces();
    return {
      success: true as const,
      message: `Masa ${sourcePrev.tableNo} hesabi Masa ${targetPrev.tableNo} uzerine tasindi.`,
    };
  } catch (e) {
    logServerError("transferTableAccountFull", e);
    return {
      success: false as const,
      message: "Tasima sirasinda bir hata olustu. Lutfen tekrar deneyin.",
    };
  }
}

export async function mergeTableAccounts(input: {
  sourceTableIds: number[];
  targetTableId: number;
}) {
  try {
    const { username, tenantId, staffId, role } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false as const, message: "Yetkisiz." };
    }
    const featureGate = await ensureCashOperationsFeature(tenantId);
    if (!featureGate.ok) {
      return { success: false as const, message: featureGate.message };
    }

    const targetTableId = Math.floor(Number(input.targetTableId));
    const sourceTableIds = [...new Set(input.sourceTableIds.map((id) => Math.floor(Number(id))))].filter(
      (id) => Number.isInteger(id) && id > 0 && id !== targetTableId,
    );

    if (sourceTableIds.length === 0) {
      return { success: false as const, message: "En az bir kaynak masa secin." };
    }

    const tablesMeta = await prisma.table.findMany({
      where: {
        id: { in: [...sourceTableIds, targetTableId] },
        restaurant: { tenantId },
      },
      select: { id: true, tableNo: true },
    });
    const noMap = new Map(tablesMeta.map((t) => [t.id, t.tableNo]));

    const result = await prisma.$transaction(
      async (tx) => runMergeTablesTx(tx, { tenantId, sourceTableIds, targetTableId }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 20000,
      },
    );

    if (!result.ok) {
      return { success: false as const, message: result.message };
    }

    const srcLabel = sourceTableIds.map((id) => `Masa ${noMap.get(id) ?? id}`).join(", ");
    const tgtLabel = `Masa ${noMap.get(targetTableId) ?? targetTableId}`;

    await writeAuditLog({
      tenantId,
      actor: buildAuditActor({ username, staffId, role }),
      actionType: "TABLE_ACCOUNT_MERGE",
      entityType: "Table",
      entityId: String(targetTableId),
      description: `Masa birlestirme: ${srcLabel} -> ${tgtLabel}.`,
    });

    revalidateTransferSurfaces();
    return {
      success: true as const,
      message: `Hesaplar ${tgtLabel} altinda birlestirildi.`,
    };
  } catch (e) {
    logServerError("mergeTableAccounts", e);
    return {
      success: false as const,
      message: "Birlestirme sirasinda bir hata olustu. Lutfen tekrar deneyin.",
    };
  }
}

export async function transferOrderLinesPartial(input: {
  sourceTableId: number;
  targetTableId: number;
  orderId: number;
  lineIndexes: number[];
}) {
  try {
    const { username, tenantId, staffId, role } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false as const, message: "Yetkisiz." };
    }
    const featureGate = await ensureCashOperationsFeature(tenantId);
    if (!featureGate.ok) {
      return { success: false as const, message: featureGate.message };
    }

    const sourceTableId = Math.floor(Number(input.sourceTableId));
    const targetTableId = Math.floor(Number(input.targetTableId));
    const orderId = Math.floor(Number(input.orderId));
    const lineIndexes = input.lineIndexes.map((i) => Math.floor(Number(i)));

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return { success: false as const, message: "Gecerli sipariş seciniz." };
    }

    const sourcePrev = await getTransferPreviewForTable({ tenantId, tableId: sourceTableId });
    const targetPrev = await getTransferPreviewForTable({ tenantId, tableId: targetTableId });

    const result = await prisma.$transaction(
      async (tx) =>
        runPartialLineTransferTx(tx, {
          tenantId,
          sourceTableId,
          targetTableId,
          orderId,
          lineIndexes,
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 15000,
      },
    );

    if (!result.ok) {
      return { success: false as const, message: result.message };
    }

    await writeAuditLog({
      tenantId,
      actor: buildAuditActor({ username, staffId, role }),
      actionType: "TABLE_ACCOUNT_TRANSFER_PARTIAL",
      entityType: "Order",
      entityId: String(orderId),
      description: `Kalem tasima: Masa ${sourcePrev.tableNo} -> Masa ${targetPrev.tableNo}. Eski sipariş #${orderId}, yeni sipariş #${result.newOrderId}. Satir indeksleri: ${lineIndexes.sort((a, b) => a - b).join(",")}.`,
    });

    revalidateTransferSurfaces();
    return {
      success: true as const,
      message: `Secilen satirlar Masa ${targetPrev.tableNo} uzerine tasindi (yeni sipariş #${result.newOrderId}).`,
      newOrderId: result.newOrderId,
    };
  } catch (e) {
    logServerError("transferOrderLinesPartial", e);
    return {
      success: false as const,
      message: "Kalem tasima sirasinda bir hata olustu.",
    };
  }
}
