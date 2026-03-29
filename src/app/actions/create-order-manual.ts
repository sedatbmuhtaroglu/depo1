"use server";

import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getProductMenuVisibilityWhere } from "@/lib/product-visibility";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";

type ManualOrderItem = { productId: number; quantity: number; price: number };

export async function createOrderManual(
  tableId: number,
  items: ManualOrderItem[],
  note?: string,
) {
  try {
    const { username, tenantId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    if (!items.length) {
      return { success: false, message: "En az bir urun ekleyin." };
    }

    const supportsStockFields =
      prismaModelHasField("Product", "trackStock") &&
      prismaModelHasField("Product", "stockQuantity");

    const productIds = [...new Set(items.map((item) => item.productId))];
    const now = new Date();
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        ...getProductMenuVisibilityWhere(now),
        category: { restaurant: { tenantId } },
      },
      select: {
        id: true,
        nameTR: true,
        isAvailable: true,
        ...(supportsStockFields
          ? ({ trackStock: true, stockQuantity: true } as Record<string, true>)
          : {}),
      },
    });
    if (products.length !== productIds.length) {
      return { success: false, message: "Siparişte gecersiz urun var." };
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const stockAdjustments = new Map<number, number>();

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return { success: false, message: "Siparişte gecersiz urun var." };
      }
      if (!product.isAvailable) {
        return {
          success: false,
          message: `"${product.nameTR}" su an siparişe kapalidir.`,
        };
      }

      const trackStock =
        supportsStockFields &&
        ((product as { trackStock?: boolean }).trackStock ?? false);
      const stockQuantityRaw = Number(
        (product as { stockQuantity?: number | null }).stockQuantity ?? 0,
      );
      const stockQuantity = Number.isFinite(stockQuantityRaw)
        ? Math.max(0, Math.floor(stockQuantityRaw))
        : 0;

      if (trackStock && stockQuantity < item.quantity) {
        return {
          success: false,
          message: `"${product.nameTR}" icin yeterli stok yok.`,
        };
      }

      if (trackStock) {
        stockAdjustments.set(
          item.productId,
          (stockAdjustments.get(item.productId) ?? 0) + item.quantity,
        );
      }
    }

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        restaurant: { tenantId },
      },
    });

    if (!table) {
      return { success: false, message: "Masa bulunamadi." };
    }

    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const order = await prisma.$transaction(async (tx) => {
      for (const [productId, quantity] of stockAdjustments.entries()) {
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            trackStock: true,
            stockQuantity: { gte: quantity },
            category: { restaurant: { tenantId } },
          },
          data: {
            stockQuantity: {
              decrement: quantity,
            },
          },
        });
        if (updateResult.count !== 1) {
          throw new Error("STOCK_CHANGED");
        }
      }

      return tx.order.create({
        data: {
          tableId: table.id,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            price: it.price,
          })),
          totalPrice: total,
          status: "PENDING",
          note: note?.trim() || null,
        },
      });
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "ORDER_MANUAL_CREATE",
      entityType: "Order",
      entityId: String(order.id),
      description: `Manuel sipariş Masa ${table.tableNo}`,
    });

    revalidatePath("/waiter");
    revalidatePath("/kitchen");
    revalidatePath("/restaurant");
    revalidatePath("/restaurant/orders");
    return { success: true, message: "Sipariş mutfaga iletildi." };
  } catch (error) {
    logServerError("create-order-manual", error);
    if (error instanceof Error && error.message === "STOCK_CHANGED") {
      return {
        success: false,
        message: "Stok bilgisi degisti. Lutfen urunleri tekrar kontrol edin.",
      };
    }
    return { success: false, message: "Sipariş oluşturulamadi." };
  }
}

