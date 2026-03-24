"use server";

import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { logServerError } from "@/lib/server-error-log";

export async function createOptionGroup(data: {
  productId: number;
  nameTR: string;
  nameEN?: string;
  minSelect?: number;
  maxSelect?: number | null;
  isRequired?: boolean;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const product = await prisma.product.findFirst({
      where: {
        id: data.productId,
        category: { restaurant: { tenantId } },
      },
      select: { id: true },
    });
    if (!product) return { success: false, message: "Ürün bulunamadı." };

    const minSelect = data.minSelect ?? 0;
    const maxSelect = data.maxSelect ?? null;
    if (maxSelect !== null && minSelect > maxSelect) {
      return { success: false, message: "Minimum seçim, maksimumdan büyük olamaz." };
    }

    await prisma.productOptionGroup.create({
      data: {
        productId: data.productId,
        nameTR: data.nameTR.trim(),
        nameEN: data.nameEN?.trim() || null,
        minSelect,
        maxSelect,
        isRequired: data.isRequired ?? minSelect > 0,
      },
    });

    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek grubu eklenemedi." };
  }
}

export async function updateOptionGroup(
  id: number,
  data: {
    nameTR?: string;
    nameEN?: string;
    minSelect?: number;
    maxSelect?: number | null;
    isRequired?: boolean;
  },
) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const group = await prisma.productOptionGroup.findFirst({
      where: {
        id,
        product: { category: { restaurant: { tenantId } } },
      },
    });
    if (!group) return { success: false, message: "Seçenek grubu bulunamadı." };

    const update: Record<string, unknown> = {};
    if (data.nameTR !== undefined) update.nameTR = data.nameTR.trim();
    if (data.nameEN !== undefined) update.nameEN = data.nameEN?.trim() || null;
    if (data.minSelect !== undefined) update.minSelect = data.minSelect;
    if (data.maxSelect !== undefined) update.maxSelect = data.maxSelect ?? null;
    if (data.isRequired !== undefined) update.isRequired = data.isRequired;

    if (
      update.minSelect !== undefined ||
      update.maxSelect !== undefined ||
      update.isRequired !== undefined
    ) {
      const minSelect = (update.minSelect as number | undefined) ?? group.minSelect;
      const maxSelect =
        (update.maxSelect as number | null | undefined) ?? group.maxSelect;
      if (maxSelect !== null && minSelect > maxSelect) {
        return {
          success: false,
          message: "Minimum seçim, maksimumdan büyük olamaz.",
        };
      }
    }

    await prisma.productOptionGroup.update({
      where: { id },
      data: update,
    });

    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek grubu güncellenemedi." };
  }
}

export async function deleteOptionGroup(id: number) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const group = await prisma.productOptionGroup.findFirst({
      where: {
        id,
        product: { category: { restaurant: { tenantId } } },
      },
      include: { options: true },
    });
    if (!group) return { success: false, message: "Seçenek grubu bulunamadı." };

    await prisma.productOptionGroup.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek grubu silinemedi." };
  }
}

export async function createOption(data: {
  groupId: number;
  nameTR: string;
  nameEN?: string;
  priceDelta?: number | null;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const group = await prisma.productOptionGroup.findFirst({
      where: {
        id: data.groupId,
        product: { category: { restaurant: { tenantId } } },
      },
    });
    if (!group) return { success: false, message: "Seçenek grubu bulunamadı." };

    await prisma.productOption.create({
      data: {
        groupId: data.groupId,
        nameTR: data.nameTR.trim(),
        nameEN: data.nameEN?.trim() || null,
        priceDelta: data.priceDelta ?? null,
      },
    });

    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek eklenemedi." };
  }
}

export async function updateOption(
  id: number,
  data: {
    nameTR?: string;
    nameEN?: string;
    priceDelta?: number | null;
    isActive?: boolean;
  },
) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const option = await prisma.productOption.findFirst({
      where: {
        id,
        group: { product: { category: { restaurant: { tenantId } } } },
      },
    });
    if (!option) return { success: false, message: "Seçenek bulunamadı." };

    const update: Record<string, unknown> = {};
    if (data.nameTR !== undefined) update.nameTR = data.nameTR.trim();
    if (data.nameEN !== undefined) update.nameEN = data.nameEN?.trim() || null;
    if (data.priceDelta !== undefined)
      update.priceDelta = data.priceDelta ?? null;
    if (data.isActive !== undefined) update.isActive = data.isActive;

    await prisma.productOption.update({
      where: { id },
      data: update,
    });

    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek güncellenemedi." };
  }
}

export async function deleteOption(id: number) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (tenantId !== ctxTenantId) return { success: false, message: "Yetkisiz." };

    const option = await prisma.productOption.findFirst({
      where: {
        id,
        group: { product: { category: { restaurant: { tenantId } } } },
      },
    });
    if (!option) return { success: false, message: "Seçenek bulunamadı." };

    await prisma.productOption.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    logServerError("product-options", e);
    return { success: false, message: "Seçenek silinemedi." };
  }
}

