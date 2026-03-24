import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import KitchenOrdersList from "./orders-list";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";
import RefreshPolling from "@/components/refresh-polling";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";

type StoredOrderItem = {
  productId: number;
  quantity: number;
  price: number;
  selectedOptions?: {
    groupId: number;
    optionIds: number[];
  }[];
};

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const { tenantId } = await getCurrentTenantOrThrow();
  const todayRange = getTurkeyDayRange(getTurkeyDateString());

  const [orders, products, restaurant, completedTodayCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: {
          in: ["PENDING", "PREPARING", "COMPLETED"],
        },
        table: {
          restaurant: {
            tenantId,
          },
        },
        AND: [STAFF_VISIBLE_ORDER_FILTER],
      },
      include: {
        table: true,
        itemOptions: {
          include: {
            option: {
              select: {
                id: true,
                nameTR: true,
                nameEN: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.product.findMany({
      select: { id: true, nameTR: true, tags: true },
    }),
    prisma.restaurant.findFirst({
      where: { tenantId },
      select: {
        kitchenWarningYellowMin: true,
        kitchenWarningOrangeMin: true,
        kitchenWarningRedMin: true,
      },
    }),
    prisma.order.count({
      where: {
        table: { restaurant: { tenantId } },
        status: "COMPLETED",
        createdAt: { gte: todayRange.startUtc, lt: todayRange.endUtc },
      },
    }),
  ]);

  const productMap = products.reduce(
    (acc, current) => {
      acc[current.id] = {
        name: current.nameTR,
        tags: (current.tags as string[] | null) ?? [],
      };
      return acc;
    },
    {} as Record<number, { name: string; tags: string[] }>,
  );

  const orderIds = orders.map((o) => o.id);
  const fallbackOptionIds = new Set<number>();
  for (const order of orders) {
    const items = (order.items as StoredOrderItem[]) ?? [];
    for (const item of items) {
      if (!Array.isArray(item.selectedOptions)) continue;
      for (const group of item.selectedOptions) {
        if (!Array.isArray(group.optionIds)) continue;
        for (const optionId of group.optionIds) {
          if (Number.isInteger(optionId)) fallbackOptionIds.add(optionId);
        }
      }
    }
  }

  const fallbackOptionList =
    fallbackOptionIds.size > 0
      ? await prisma.productOption.findMany({
          where: { id: { in: [...fallbackOptionIds] } },
          select: { id: true, nameTR: true, nameEN: true },
        })
      : [];
  const fallbackOptionNameMap = new Map(
    fallbackOptionList.map((option) => [
      option.id,
      option.nameTR?.trim() || option.nameEN?.trim() || "",
    ]),
  );

  const cancellations =
    orderIds.length > 0
      ? await prisma.orderItemCancellation.findMany({
          where: { tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, quantity: true },
        })
      : [];
  const cashAdjustments =
    orderIds.length > 0
      ? await prisma.cashOrderAdjustment.findMany({
          where: { tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, adjustedQuantity: true },
        })
      : [];
  const cancellationMap = buildOrderItemAdjustmentMap(cancellations);
  const cashAdjustmentMap = buildOrderItemAdjustmentMap(
    cashAdjustments.map((adjustment) => ({
      orderId: adjustment.orderId,
      productId: adjustment.productId,
      quantity: adjustment.adjustedQuantity,
    })),
  );

  type KitchenStatus = "PENDING" | "PREPARING" | "COMPLETED";
  const cleanOrders = orders.map((order) => {
    const relationOptionRows = order.itemOptions.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
      optionName: row.option?.nameTR?.trim() || row.option?.nameEN?.trim() || "",
    }));
    const usedRelationRowIndexes = new Set<number>();

    const resolveRelationOptionNames = (productId: number, quantity: number) => {
      const exactMatchIndexes = relationOptionRows
        .map((row, index) => ({ row, index }))
        .filter(
          ({ row, index }) =>
            row.productId === productId &&
            row.quantity === quantity &&
            !usedRelationRowIndexes.has(index),
        );

      const fallbackIndexes =
        exactMatchIndexes.length > 0
          ? exactMatchIndexes
          : relationOptionRows
              .map((row, index) => ({ row, index }))
              .filter(
                ({ row, index }) =>
                  row.productId === productId && !usedRelationRowIndexes.has(index),
              );

      for (const { index } of fallbackIndexes) usedRelationRowIndexes.add(index);

      return fallbackIndexes
        .map(({ row }) => row.optionName)
        .filter((name) => name.length > 0);
    };

    const resolveFallbackOptionNames = (item: StoredOrderItem) => {
      if (!Array.isArray(item.selectedOptions)) return [];
      return item.selectedOptions
        .flatMap((group) => (Array.isArray(group.optionIds) ? group.optionIds : []))
        .map((optionId) => fallbackOptionNameMap.get(optionId) ?? "")
        .filter((name) => name.length > 0);
    };

    const mappedItems = (order.items as StoredOrderItem[]).map((item) => {
      const p = productMap[item.productId];
      const relationOptionNames = resolveRelationOptionNames(
        item.productId,
        item.quantity,
      );
      const fallbackOptionNames =
        relationOptionNames.length > 0 ? [] : resolveFallbackOptionNames(item);
      const selectedOptions =
        relationOptionNames.length > 0 ? relationOptionNames : fallbackOptionNames;
      const effectiveQuantity = getEffectiveOrderItemQuantity({
        orderId: order.id,
        productId: item.productId,
        originalQuantity: item.quantity,
        cancellationMap,
        cashAdjustmentMap,
      });

      return {
        ...item,
        productName: p?.name ?? "Silinmis / Bilinmeyen Urun",
        tags: p?.tags ?? [],
        selectedOptions,
        effectiveQuantity,
      };
    });

    return {
      id: order.id,
      table: { tableNo: order.table.tableNo },
      note: order.note,
      items: mappedItems.filter((item) => item.effectiveQuantity > 0),
      totalPrice: order.totalPrice.toString(),
      status: order.status as KitchenStatus,
      createdAt: order.createdAt,
      preparingStartedAt: order.preparingStartedAt,
    };
  }).filter((order) => order.items.length > 0);

  const yellowMin = restaurant?.kitchenWarningYellowMin ?? 5;
  const orangeMin = restaurant?.kitchenWarningOrangeMin ?? 10;
  const redMin = restaurant?.kitchenWarningRedMin ?? 15;
  const activeOrderCount = cleanOrders.filter(
    (order) => order.status === "PENDING" || order.status === "PREPARING",
  ).length;

  return (
    <>
      <RefreshPolling intervalMs={5000} pauseWhenHidden />
      <KitchenOrdersList
        initialOrders={cleanOrders}
        cancellations={cancellations}
        cashAdjustments={cashAdjustments.map((adjustment) => ({
          orderId: adjustment.orderId,
          productId: adjustment.productId,
          quantity: adjustment.adjustedQuantity,
        }))}
        warningMinutes={{ yellow: yellowMin, orange: orangeMin, red: redMin }}
        summary={{
          activeOrderCount,
          completedTodayCount,
          lastUpdatedIso: new Date().toISOString(),
        }}
      />
    </>
  );
}

