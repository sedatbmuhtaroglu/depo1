"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { logServerError } from "@/lib/server-error-log";
import {
  assertCategoryBelongsToMenu,
  assertMenuBelongsToTenant,
  clampShowcaseTitleSubtitle,
  parseMenuFrequentPlacement,
  parseMenuShowcaseAutoplaySpeed,
  validateMenuShowcaseProductIds,
} from "@/lib/menu-showcase";
import { hasFeature } from "@/core/entitlements/engine";

const SHOWCASE_REVALIDATE_PATHS = [
  "/restaurant/menu",
  "/restaurant/menu/showcase/popular",
  "/restaurant/menu/showcase/frequent",
] as const;

export async function savePopularMenuShowcase(input: {
  menuId: number;
  categoryId: number;
  title: string;
  subtitle: string | null | undefined;
  isEnabled: boolean;
  productIds: number[];
  autoplayEnabled: boolean;
  autoplaySpeed: unknown;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false as const, message: "Yetkisiz." };

    const showcaseEnabled = await hasFeature(tenantId, "SHOWCASE_RAILS");
    if (!showcaseEnabled) {
      return {
        success: false as const,
        message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      };
    }

    const menu = await assertMenuBelongsToTenant(input.menuId, tenantId);
    if (!menu) return { success: false as const, message: "Menü bulunamadı." };

    const category = await assertCategoryBelongsToMenu(input.categoryId, input.menuId, tenantId);
    if (!category) return { success: false as const, message: "Kategori bu menüye ait değil." };

    const { title, subtitle } = clampShowcaseTitleSubtitle({
      title: input.title,
      subtitle: input.subtitle,
    });
    if (!title) {
      return { success: false as const, message: "Başlık girin." };
    }

    const validated = await validateMenuShowcaseProductIds({
      menuId: input.menuId,
      tenantId,
      productIds: input.productIds,
      requireCategoryId: input.categoryId,
    });
    if (!validated.ok) {
      return { success: false as const, message: validated.message };
    }

    const speed = parseMenuShowcaseAutoplaySpeed(input.autoplaySpeed);
    if (!speed) {
      return { success: false as const, message: "Geçerli bir kaydırma hızı seçin." };
    }

    await prisma.$transaction(async (tx) => {
      const showcase = await tx.menuPopularShowcase.upsert({
        where: {
          menuId_categoryId: {
            menuId: input.menuId,
            categoryId: input.categoryId,
          },
        },
        create: {
          tenantId,
          menuId: input.menuId,
          categoryId: input.categoryId,
          title,
          subtitle,
          isEnabled: input.isEnabled,
          autoplayEnabled: input.autoplayEnabled,
          autoplaySpeed: speed,
        },
        update: {
          title,
          subtitle,
          isEnabled: input.isEnabled,
          autoplayEnabled: input.autoplayEnabled,
          autoplaySpeed: speed,
        },
      });

      await tx.menuPopularShowcaseItem.deleteMany({
        where: { showcaseId: showcase.id },
      });
      if (validated.normalizedIds.length > 0) {
        await tx.menuPopularShowcaseItem.createMany({
          data: validated.normalizedIds.map((productId, sortOrder) => ({
            showcaseId: showcase.id,
            productId,
            sortOrder,
          })),
        });
      }
    });

    for (const p of SHOWCASE_REVALIDATE_PATHS) {
      revalidatePath(p);
    }
    return { success: true as const };
  } catch (error) {
    logServerError("menu-showcase popular", error);
    return { success: false as const, message: "Kayıt sırasında bir hata oluştu." };
  }
}

export async function saveFrequentMenuShowcase(input: {
  menuId: number;
  title: string;
  subtitle: string | null | undefined;
  isEnabled: boolean;
  productIds: number[];
  placement: unknown;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false as const, message: "Yetkisiz." };

    const showcaseEnabled = await hasFeature(tenantId, "SHOWCASE_RAILS");
    if (!showcaseEnabled) {
      return {
        success: false as const,
        message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      };
    }

    const menu = await assertMenuBelongsToTenant(input.menuId, tenantId);
    if (!menu) return { success: false as const, message: "Menü bulunamadı." };

    const { title, subtitle } = clampShowcaseTitleSubtitle({
      title: input.title,
      subtitle: input.subtitle,
    });
    if (!title) {
      return { success: false as const, message: "Başlık girin." };
    }

    const validated = await validateMenuShowcaseProductIds({
      menuId: input.menuId,
      tenantId,
      productIds: input.productIds,
    });
    if (!validated.ok) {
      return { success: false as const, message: validated.message };
    }

    const placement = parseMenuFrequentPlacement(input.placement);
    if (!placement) {
      return { success: false as const, message: "Geçerli bir konum seçin." };
    }

    await prisma.$transaction(async (tx) => {
      const showcase = await tx.menuFrequentShowcase.upsert({
        where: { menuId: input.menuId },
        create: {
          tenantId,
          menuId: input.menuId,
          title,
          subtitle,
          isEnabled: input.isEnabled,
          placement,
        },
        update: {
          title,
          subtitle,
          isEnabled: input.isEnabled,
          placement,
        },
      });

      await tx.menuFrequentShowcaseItem.deleteMany({
        where: { showcaseId: showcase.id },
      });
      if (validated.normalizedIds.length > 0) {
        await tx.menuFrequentShowcaseItem.createMany({
          data: validated.normalizedIds.map((productId, sortOrder) => ({
            showcaseId: showcase.id,
            productId,
            sortOrder,
          })),
        });
      }
    });

    for (const p of SHOWCASE_REVALIDATE_PATHS) {
      revalidatePath(p);
    }
    return { success: true as const };
  } catch (error) {
    logServerError("menu-showcase frequent", error);
    return { success: false as const, message: "Kayıt sırasında bir hata oluştu." };
  }
}
