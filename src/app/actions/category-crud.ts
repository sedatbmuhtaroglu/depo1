"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function createCategory(
  restaurantId: number,
  nameTR: string,
  nameEN?: string,
  menuId?: number,
) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const r = await prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
    });
    if (!r) return { success: false, message: "Restoran bulunamadı." };

    let resolvedMenuId: number | null = null;
    if (menuId !== undefined) {
      const menu = await prisma.menu.findFirst({
        where: {
          id: menuId,
          tenantId,
          OR: [{ restaurantId: null }, { restaurantId }],
        },
        select: { id: true },
      });
      if (!menu) return { success: false, message: "Menu bulunamadi." };
      resolvedMenuId = menu.id;
    }

    const cat = await prisma.category.create({
      data: {
        restaurantId,
        menuId: resolvedMenuId,
        nameTR: nameTR.trim(),
        nameEN: nameEN?.trim() || null,
      },
    });
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "CATEGORY_CREATE",
      entityType: "Category",
      entityId: String(cat.id),
      description: nameTR.trim(),
    });
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (e) {
    logServerError("category-crud", e);
    return { success: false, message: "Kategori eklenemedi." };
  }
}

export async function updateCategory(
  categoryId: number,
  nameTR: string,
  nameEN?: string,
) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, restaurant: { tenantId } },
    });
    if (!cat) return { success: false, message: "Kategori bulunamadı." };
    await prisma.category.update({
      where: { id: categoryId },
      data: {
        nameTR: nameTR.trim(),
        nameEN: nameEN?.trim() || null,
      },
    });
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "CATEGORY_UPDATE",
      entityType: "Category",
      entityId: String(categoryId),
      description: nameTR.trim(),
    });
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (e) {
    logServerError("category-crud", e);
    return { success: false, message: "Kategori güncellenemedi." };
  }
}

export async function deleteCategory(categoryId: number) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };
    const cat = await prisma.category.findFirst({
      where: { id: categoryId, restaurant: { tenantId } },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) return { success: false, message: "Kategori bulunamadı." };
    if (cat._count.products > 0) {
      return { success: false, message: "İçinde ürün varken kategori silinemez." };
    }
    await prisma.category.delete({ where: { id: categoryId } });
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "CATEGORY_DELETE",
      entityType: "Category",
      entityId: String(categoryId),
      description: cat.nameTR,
    });
    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (e) {
    logServerError("category-crud", e);
    return { success: false, message: "Kategori silinemedi." };
  }
}
