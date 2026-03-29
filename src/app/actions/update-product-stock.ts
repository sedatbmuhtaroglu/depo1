"use server";

import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { logServerError } from "@/lib/server-error-log";
import { ensureTenantFeatureEnabled } from "@/lib/tenant-feature-enforcement";

export async function updateProductStock(input: {
  productId: number;
  trackStock: boolean;
  stockQuantity: number;
}) {
  try {
    const { tenantId, username } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    const featureGate = await ensureTenantFeatureEnabled(tenantId, "STOCK_MANAGEMENT");
    if (!featureGate.ok) {
      return { success: false, message: featureGate.message };
    }

    const productId = Number(input.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return { success: false, message: "Gecerli urun seciniz." };
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        category: { restaurant: { tenantId } },
      },
      select: {
        id: true,
        nameTR: true,
      },
    });
    if (!product) {
      return { success: false, message: "Urun bulunamadi." };
    }

    const trackStock = Boolean(input.trackStock);
    const stockQuantity = Math.max(0, Math.floor(Number(input.stockQuantity) || 0));

    await prisma.product.update({
      where: { id: product.id },
      data: {
        trackStock,
        stockQuantity: trackStock ? stockQuantity : 0,
      },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "PRODUCT_STOCK_UPDATE",
      entityType: "Product",
      entityId: String(product.id),
      description: `${product.nameTR} (trackStock=${trackStock}, qty=${trackStock ? stockQuantity : 0})`,
    });

    const [tenantMenus, tenantTableIds] = await Promise.all([
      prisma.menu.findMany({
        where: { tenantId },
        select: { id: true },
        take: 100,
      }),
      prisma.table.findMany({
        where: {
          restaurant: { tenantId },
        },
        select: { id: true },
        take: 500,
      }),
    ]);

    revalidatePath("/restaurant/stocks");
    revalidatePath("/restaurant/menu");
    revalidatePath("/waiter");
    revalidatePath("/restaurant");
    revalidatePath("/[tableId]", "page");
    revalidatePath("/menu/[slug]/[tableId]", "page");
    revalidatePath("/menu", "layout");
    tenantTableIds.forEach((table) => {
      revalidatePath(`/${table.id}`);
    });
    tenantMenus.forEach((menu) => {
      tenantTableIds.forEach((table) => {
        revalidatePath(`/menu/${menu.id}/${table.id}`);
      });
    });
    return { success: true };
  } catch (error) {
    logServerError("update-product-stock", error);
    return { success: false, message: "Stok guncellenemedi." };
  }
}
