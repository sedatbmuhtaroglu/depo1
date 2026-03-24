"use server";

import { Prisma } from "@prisma/client";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { assertTenantLimit, isTenantLimitExceededError } from "@/lib/tenant-limits";
import { assertProductCreateCapability } from "@/lib/product-visibility";
import { logServerError } from "@/lib/server-error-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function createProduct(data: {
  categoryId: number;
  nameTR: string;
  nameEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
  // Menü görünürlüğü (stoktan bağımsız)
  isActive?: boolean;
  // Opsiyonel zaman bazlı görünürlük: bu pencerede değilse ürün menüde görünmez.
  visibleFrom?: string | null;
  visibleUntil?: string | null;
  // Öne çıkan + sıralama
  isFeatured?: boolean;
  sortOrder?: number;
  trackStock?: boolean;
  stockQuantity?: number;
  tags?: string[];
  options?: unknown;
}) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };

    const normalizeSortOrder = (raw: unknown): number => {
      if (raw === undefined || raw === null) return 0;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0;
      const v = Math.floor(n);
      return Math.max(0, v);
    };

    const parseOptionalDateTime = (raw: string | null | undefined): Date | null => {
      if (raw === undefined || raw === null) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) {
        throw new Error("Gecersiz tarih girisi.");
      }
      return d;
    };

    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, restaurant: { tenantId } },
      select: { id: true },
    });
    if (!cat) return { success: false, message: "Kategori bulunamadı." };

    const normalizedNameTR = data.nameTR.trim();
    if (!normalizedNameTR) return { success: false, message: "Ürün adı girin." };
    if (normalizedNameTR.length > 120) {
      return { success: false, message: "Ürün adı çok uzun (maks 120)." };
    }

    if (data.descriptionTR && data.descriptionTR.length > 1000) {
      return { success: false, message: "Açıklama çok uzun (maks 1000)." };
    }

    const normalizedPrice = Number(data.price);
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
      return { success: false, message: "Geçerli bir fiyat girin." };
    }

    const supportsStockFields =
      prismaModelHasField("Product", "trackStock") &&
      prismaModelHasField("Product", "stockQuantity");

    const normalizedStockQuantity = Number.isFinite(data.stockQuantity)
      ? Math.max(0, Math.floor(Number(data.stockQuantity)))
      : 0;

    const isActive = data.isActive ?? true;
    const isFeatured = data.isFeatured ?? false;
    const sortOrder = normalizeSortOrder(data.sortOrder);
    const visibleFrom = parseOptionalDateTime(data.visibleFrom);
    const visibleUntil = parseOptionalDateTime(data.visibleUntil);

    if (visibleFrom && visibleUntil && visibleFrom > visibleUntil) {
      return { success: false, message: "Gorunurluk baslangic tarihi, bitis tarihinden buyuk olamaz." };
    }

    const createData: Record<string, unknown> = {
      categoryId: data.categoryId,
      nameTR: normalizedNameTR,
      nameEN: data.nameEN?.trim() || null,
      descriptionTR: data.descriptionTR?.trim() || null,
      descriptionEN: data.descriptionEN?.trim() || null,
      price: normalizedPrice,
      imageUrl: data.imageUrl?.trim() || null,
      isAvailable: data.isAvailable ?? true,
      isActive,
      isFeatured,
      sortOrder,
      visibleFrom: visibleFrom ?? undefined,
      visibleUntil: visibleUntil ?? undefined,
      tags: data.tags ?? undefined,
      options: data.options ?? undefined,
    };

    if (supportsStockFields) {
      createData.trackStock = data.trackStock ?? false;
      createData.stockQuantity = normalizedStockQuantity;
    }

    const product = await prisma.$transaction(
      async (tx) => {
        assertProductCreateCapability(tenantId);
        await assertTenantLimit(tenantId, "PRODUCTS", tx);
        return tx.product.create({
          data: createData as Prisma.ProductUncheckedCreateInput,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "PRODUCT_CREATE",
      entityType: "Product",
      entityId: String(product.id),
      description: data.nameTR.trim(),
    });

    revalidatePath("/restaurant/menu");
    revalidatePath("/restaurant/stocks");
    return { success: true };
  } catch (error) {
    if (isTenantLimitExceededError(error)) {
      return {
        success: false,
        message: error.message,
        limit: {
          resource: error.resource,
          used: error.used,
          max: error.max,
        },
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return {
        success: false,
        message: "İşlem yoğunluğu nedeniyle ürün eklenemedi. Lütfen tekrar deneyin.",
      };
    }

    logServerError("product-crud", error);
    return { success: false, message: "Ürün eklenemedi." };
  }
}

export async function updateProduct(
  productId: number,
  data: {
    nameTR?: string;
    nameEN?: string;
    descriptionTR?: string;
    descriptionEN?: string;
    price?: number;
    imageUrl?: string | null;
    isAvailable?: boolean;
    isActive?: boolean;
    visibleFrom?: string | null;
    visibleUntil?: string | null;
    isFeatured?: boolean;
    sortOrder?: number;
    trackStock?: boolean;
    stockQuantity?: number;
    tags?: string[] | null;
    options?: unknown;
  },
) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };

    const p = await prisma.product.findFirst({
      where: { id: productId, category: { restaurant: { tenantId } } },
    });
    if (!p) return { success: false, message: "Ürün bulunamadı." };

    const normalizeSortOrder = (raw: unknown): number => {
      if (raw === undefined || raw === null) return p.sortOrder ?? 0;
      const n = Number(raw);
      if (!Number.isFinite(n)) return p.sortOrder ?? 0;
      const v = Math.floor(n);
      return Math.max(0, v);
    };

    const parseOptionalDateTime = (raw: string | null | undefined): Date | null => {
      if (raw === undefined || raw === null) return null;
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) {
        throw new Error("Gecersiz tarih girisi.");
      }
      return d;
    };

    const update: Record<string, unknown> = {};
    if (data.nameTR !== undefined) {
      const normalizedNameTR = data.nameTR.trim();
      if (!normalizedNameTR) return { success: false, message: "Ürün adı girin." };
      if (normalizedNameTR.length > 120) {
        return { success: false, message: "Ürün adı çok uzun (maks 120)." };
      }
      update.nameTR = normalizedNameTR;
    }
    if (data.nameEN !== undefined) update.nameEN = data.nameEN?.trim().slice(0, 120) || null;
    if (data.descriptionTR !== undefined) {
      const d = data.descriptionTR?.trim() || null;
      if (d && d.length > 1000) {
        return { success: false, message: "Açıklama çok uzun (maks 1000)." };
      }
      update.descriptionTR = d;
    }
    if (data.descriptionEN !== undefined) update.descriptionEN = data.descriptionEN?.trim().slice(0, 1000) || null;
    if (data.price !== undefined) {
      const normalizedPrice = Number(data.price);
      if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) {
        return { success: false, message: "Geçerli bir fiyat girin." };
      }
      update.price = normalizedPrice;
    }
    if (data.imageUrl !== undefined) update.imageUrl = data.imageUrl?.trim() || null;
    if (data.isAvailable !== undefined) update.isAvailable = data.isAvailable;

    let visibleFromForValidation: Date | null | undefined;
    let visibleUntilForValidation: Date | null | undefined;
    if (data.isActive !== undefined) update.isActive = data.isActive;
    if (data.isFeatured !== undefined) update.isFeatured = data.isFeatured;
    if (data.sortOrder !== undefined) update.sortOrder = normalizeSortOrder(data.sortOrder);

    if (data.visibleFrom !== undefined) {
      const v = parseOptionalDateTime(data.visibleFrom);
      update.visibleFrom = v ?? null;
      visibleFromForValidation = v;
    }
    if (data.visibleUntil !== undefined) {
      const v = parseOptionalDateTime(data.visibleUntil);
      update.visibleUntil = v ?? null;
      visibleUntilForValidation = v;
    }

    const effectiveVisibleFrom =
      visibleFromForValidation !== undefined ? visibleFromForValidation : (p.visibleFrom as Date | null);
    const effectiveVisibleUntil =
      visibleUntilForValidation !== undefined ? visibleUntilForValidation : (p.visibleUntil as Date | null);
    if (effectiveVisibleFrom && effectiveVisibleUntil && effectiveVisibleFrom > effectiveVisibleUntil) {
      return { success: false, message: "Gorunurluk baslangic tarihi, bitis tarihinden buyuk olamaz." };
    }

    const supportsStockFields =
      prismaModelHasField("Product", "trackStock") &&
      prismaModelHasField("Product", "stockQuantity");

    if (supportsStockFields && data.trackStock !== undefined) {
      update.trackStock = data.trackStock;
    }
    if (supportsStockFields && data.stockQuantity !== undefined) {
      const normalizedStock = Math.max(0, Math.floor(Number(data.stockQuantity)));
      if (!Number.isFinite(normalizedStock)) {
        return { success: false, message: "Geçerli bir stok adedi giriniz." };
      }
      update.stockQuantity = normalizedStock;
    }

    if (data.tags !== undefined) update.tags = data.tags;
    if (data.options !== undefined) update.options = data.options;

    await prisma.product.update({
      where: { id: productId },
      data: update as Prisma.ProductUncheckedUpdateInput,
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "PRODUCT_UPDATE",
      entityType: "Product",
      entityId: String(productId),
      description:
        p.nameTR +
        (data.isAvailable !== undefined ? ` (stokta yok: ${!data.isAvailable})` : "") +
        (data.stockQuantity !== undefined ? ` (stok adedi: ${data.stockQuantity})` : ""),
    });

    revalidatePath("/restaurant/menu");
    revalidatePath("/restaurant/stocks");
    return { success: true };
  } catch (error) {
    logServerError("product-crud", error);
    return { success: false, message: "Ürün güncellenemedi." };
  }
}

export async function deleteProduct(productId: number) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };

    const p = await prisma.product.findFirst({
      where: { id: productId, category: { restaurant: { tenantId } } },
    });
    if (!p) return { success: false, message: "Ürün bulunamadı." };

    await prisma.product.delete({ where: { id: productId } });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "PRODUCT_DELETE",
      entityType: "Product",
      entityId: String(productId),
      description: p.nameTR,
    });

    revalidatePath("/restaurant/menu");
    revalidatePath("/restaurant/stocks");
    return { success: true };
  } catch (error) {
    logServerError("product-crud", error);
    return { success: false, message: "Ürün silinemedi." };
  }
}

export async function bulkUpdatePrices(options: {
  categoryId?: number;
  restaurantId?: number;
  type: "percent" | "fixed";
  value: number;
}) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz.", count: 0 };

    const products = await prisma.product.findMany({
      where:
        options.categoryId
          ? {
              categoryId: options.categoryId,
              category: { restaurant: { tenantId } },
            }
          : options.restaurantId
            ? {
                category: {
                  restaurantId: options.restaurantId,
                  restaurant: { tenantId },
                },
              }
            : { category: { restaurant: { tenantId } } },
      select: { id: true, price: true },
    });

    for (const p of products) {
      const current = Number(p.price);
      const newPrice =
        options.type === "percent"
          ? current * (1 + options.value / 100)
          : current + options.value;

      await prisma.product.update({
        where: { id: p.id },
        data: { price: Math.round(newPrice * 100) / 100 },
      });
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "PRODUCT_BULK_PRICE",
      entityType: "Product",
      description: `Toplu fiyat: ${options.type} ${options.value}, ${products.length} ürün`,
    });

    revalidatePath("/restaurant/menu");
    revalidatePath("/restaurant/stocks");
    return { success: true, count: products.length };
  } catch (error) {
    logServerError("product-crud", error);
    return { success: false, message: "Toplu güncelleme yapılamadı.", count: 0 };
  }
}
