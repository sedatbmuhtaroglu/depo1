'use server';

import { requireCashierWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { prisma } from "@/lib/prisma";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { logServerError } from "@/lib/server-error-log";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

export async function getBillRequestPaymentSummary(billRequestId: number) {
  try {
    const { tenantId } = await requireCashierWaiterOrManagerSession("billrequest.view");
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "CASH_OPERATIONS");
    if (!featureGate.ok) {
      return { success: false, message: featureGate.message };
    }

    const billRequest = await prisma.billRequest.findFirst({
      where: {
        id: billRequestId,
        tenantId,
      },
      include: {
        table: {
          select: {
            id: true,
            tableNo: true,
          },
        },
      },
    });

    if (!billRequest) {
      return {
        success: false,
        message: "Hesap istegi bulunamadi.",
      };
    }

    const snapshot = await getTableBillingSnapshot({
      tenantId,
      tableId: billRequest.tableId,
    });

    const cycleTimestampFilter = snapshot.cycleStartAt
      ? {
          OR: [
            { createdAt: { gt: snapshot.cycleStartAt } },
            { readyAt: { gt: snapshot.cycleStartAt } },
            { deliveredAt: { gt: snapshot.cycleStartAt } },
          ],
        }
      : {};

    const cycleOrders = await prisma.order.findMany({
      where: {
        tableId: billRequest.tableId,
        table: { restaurant: { tenantId } },
        status: {
          in: ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING", "COMPLETED"],
        },
        ...cycleTimestampFilter,
      },
      select: {
        id: true,
        status: true,
        readyAt: true,
        deliveredAt: true,
        items: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const cycleOrderIds = cycleOrders.map((order) => order.id);
    const [cancellations, cashAdjustments] = await Promise.all([
      cycleOrderIds.length > 0
        ? prisma.orderItemCancellation.findMany({
            where: { tenantId, orderId: { in: cycleOrderIds } },
            select: { orderId: true, productId: true, quantity: true },
          })
        : Promise.resolve([]),
      cycleOrderIds.length > 0
        ? prisma.cashOrderAdjustment.findMany({
            where: { tenantId, orderId: { in: cycleOrderIds } },
            select: { orderId: true, productId: true, adjustedQuantity: true },
          })
        : Promise.resolve([]),
    ]);
    const cancellationMap = new Map<string, number>();
    for (const row of cancellations) {
      const key = `${row.orderId}:${row.productId}`;
      cancellationMap.set(key, (cancellationMap.get(key) ?? 0) + row.quantity);
    }
    const cashAdjustmentMap = new Map<string, number>();
    for (const row of cashAdjustments) {
      const key = `${row.orderId}:${row.productId}`;
      cashAdjustmentMap.set(key, (cashAdjustmentMap.get(key) ?? 0) + row.adjustedQuantity);
    }

    const productIds = new Set<number>();
    for (const order of cycleOrders) {
      const rows = Array.isArray(order.items)
        ? (order.items as Array<{ productId: number }>)
        : [];
      for (const row of rows) {
        productIds.add(row.productId);
      }
    }

    const products =
      productIds.size > 0
        ? await prisma.product.findMany({
            where: { id: { in: [...productIds] } },
            select: { id: true, nameTR: true },
          })
        : [];
    const productNameMap = new Map(products.map((product) => [product.id, product.nameTR]));

    const completedLineMap = new Map<
      number,
      { productName: string; quantity: number; lineTotal: number }
    >();
    const activeOrderLines: Array<{
      productName: string;
      quantity: number;
      lineTotal: number;
      statusLabel: string;
    }> = [];

    const getStatusLabel = (order: {
      status:
        | "PENDING_WAITER_APPROVAL"
        | "PENDING"
        | "PREPARING"
        | "COMPLETED"
        | "REJECTED";
      readyAt: Date | null;
      deliveredAt: Date | null;
    }) => {
      if (order.status === "REJECTED") return "İptal Edildi";
      if (order.status === "PREPARING") return "Hazırlaniyor";
      if (order.status === "COMPLETED" && !order.deliveredAt) return "Teslime Hazır";
      if (order.status === "COMPLETED" && order.deliveredAt) return "Teslim Edildi";
      if (order.status === "PENDING") return "Mutfakta Sirada";
      return "Garson Onayı Bekliyor";
    };

    for (const order of cycleOrders) {
      const rows = Array.isArray(order.items)
        ? (order.items as Array<{ productId: number; quantity: number; price: number }>)
        : [];

      for (const row of rows) {
        const productName = productNameMap.get(row.productId) ?? `Urun #${row.productId}`;
        const quantity = Number(row.quantity) || 0;
        const key = `${order.id}:${row.productId}`;
        const cancelledQty = cancellationMap.get(key) ?? 0;
        const adjustedQty = cashAdjustmentMap.get(key) ?? 0;
        const effectiveQty = Math.max(0, quantity - cancelledQty - adjustedQty);
        const unitPrice = Number(row.price) || 0;
        const lineTotal = effectiveQty * unitPrice;
        if (effectiveQty <= 0 || lineTotal < 0) continue;

        if (order.status === "COMPLETED") {
          const existing = completedLineMap.get(row.productId);
          if (!existing) {
            completedLineMap.set(row.productId, {
              productName,
              quantity: effectiveQty,
              lineTotal,
            });
          } else {
            existing.quantity += effectiveQty;
            existing.lineTotal += lineTotal;
          }
        }

        activeOrderLines.push({
          productName,
          quantity: effectiveQty,
          lineTotal,
          statusLabel: getStatusLabel(order),
        });
      }
    }

    return {
      success: true,
      summary: {
        tableId: billRequest.table.id,
        tableNo: billRequest.table.tableNo,
        totalAmount: snapshot.totalAmount,
        totalCompletedAmount: snapshot.totalCompletedAmount,
        billableTotal: snapshot.totalFromOrders,
        onlinePaidTotal: snapshot.onlinePaidTotal,
        grossPaidAmount: snapshot.grossPaidAmount,
        refundedAmount: snapshot.refundedAmount,
        netPaidAmount: snapshot.netPaidAmount,
        overpaidAmount: snapshot.overpaidAmount,
        collectedAtTableTotal: snapshot.netPaidAmount,
        collectibleTotal: Math.max(0, snapshot.remainingAmount),
        remainingAmount: snapshot.remainingAmount,
        completedCycleLines: [...completedLineMap.values()],
        activeOrderLines,
      },
    };
  } catch (error) {
    logServerError("get-bill-request-payment-summary", error);
    return {
      success: false,
      message: "Anlik hesap ozeti alinamadi.",
    };
  }
}



