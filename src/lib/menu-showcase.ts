import type {
  MenuFrequentShowcasePlacement,
  MenuShowcaseAutoplaySpeed,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProductMenuVisibilityWhere } from "@/lib/product-visibility";

export function isProductSelectableForMenuShowcase(
  p: { isActive: boolean; visibleFrom: string | null; visibleUntil: string | null },
  now: Date = new Date(),
): boolean {
  if (!p.isActive) return false;
  if (p.visibleFrom && new Date(p.visibleFrom) > now) return false;
  if (p.visibleUntil && new Date(p.visibleUntil) < now) return false;
  return true;
}

/** Üst sınır: vitrin kartları hem performans hem düzen için. */
export const MENU_SHOWCASE_MAX_ITEMS = 8;

const TITLE_MAX = 160;
const SUBTITLE_MAX = 320;

export function clampShowcaseTitleSubtitle(input: {
  title: string;
  subtitle: string | null | undefined;
}): { title: string; subtitle: string | null } {
  const title = input.title.trim().slice(0, TITLE_MAX);
  const subtitleRaw = input.subtitle?.trim();
  const subtitle =
    subtitleRaw && subtitleRaw.length > 0 ? subtitleRaw.slice(0, SUBTITLE_MAX) : null;
  return { title, subtitle };
}

/**
 * Aktif menüde görünür ürünlerden seçim doğrulaması (müdür kaydı + storefront tutarlılığı).
 * `requireCategoryId` yalnızca Popüler vitrin için: tüm ürünler bu kategoride olmalı.
 */
export async function validateMenuShowcaseProductIds(options: {
  menuId: number;
  tenantId: number;
  productIds: number[];
  requireCategoryId?: number;
}): Promise<{ ok: true; normalizedIds: number[] } | { ok: false; message: string }> {
  const raw = options.productIds;
  const unique = [...new Set(raw)];
  if (unique.length !== raw.length) {
    return { ok: false, message: "Aynı ürün iki kez eklenemez." };
  }
  if (unique.length > MENU_SHOWCASE_MAX_ITEMS) {
    return { ok: false, message: `En fazla ${MENU_SHOWCASE_MAX_ITEMS} ürün seçebilirsiniz.` };
  }
  if (unique.length === 0) {
    return { ok: true, normalizedIds: [] };
  }

  const now = new Date();
  const visibility = getProductMenuVisibilityWhere(now);

  const categoryWhere: Prisma.CategoryWhereInput = {
    menuId: options.menuId,
    restaurant: { tenantId: options.tenantId },
  };

  const products = await prisma.product.findMany({
    where: {
      AND: [
        visibility,
        {
          id: { in: unique },
          category: categoryWhere,
          ...(options.requireCategoryId != null
            ? { categoryId: options.requireCategoryId }
            : {}),
        },
      ],
    },
    select: { id: true },
  });

  if (products.length !== unique.length) {
    return {
      ok: false,
      message:
        "Seçilen ürünlerden bazıları bu menüde kullanılamıyor veya menüde görünür değil.",
    };
  }

  const idOk = new Set(products.map((p) => p.id));
  const normalizedIds = unique.filter((id) => idOk.has(id));
  return { ok: true, normalizedIds };
}

export async function assertMenuBelongsToTenant(menuId: number, tenantId: number) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, tenantId },
    select: { id: true },
  });
  return menu;
}

export async function assertCategoryBelongsToMenu(
  categoryId: number,
  menuId: number,
  tenantId: number,
) {
  return prisma.category.findFirst({
    where: {
      id: categoryId,
      menuId,
      restaurant: { tenantId },
    },
    select: { id: true },
  });
}

export function parseMenuShowcaseAutoplaySpeed(
  value: unknown,
): MenuShowcaseAutoplaySpeed | null {
  if (value === "SLOW" || value === "NORMAL") return value;
  return null;
}

export function parseMenuFrequentPlacement(
  value: unknown,
): MenuFrequentShowcasePlacement | null {
  if (
    value === "ABOVE_CATEGORIES" ||
    value === "BELOW_CATEGORIES" ||
    value === "STICKY" ||
    value === "BLOCK"
  ) {
    return value;
  }
  return null;
}

export const FREQUENT_PLACEMENT_LABELS: Record<
  MenuFrequentShowcasePlacement,
  { title: string; hint: string }
> = {
  ABOVE_CATEGORIES: {
    title: "Kategori üstünde",
    hint: "Kategori sekmelerinden hemen önce, üst alanın altında gösterilir.",
  },
  BELOW_CATEGORIES: {
    title: "Kategori altında",
    hint: "Kategori şeridinin altında, ürün listesinin üstünde klasik vitrin.",
  },
  STICKY: {
    title: "Yapışkan (sticky)",
    hint: "Kaydırırken üstte ince bir şerit olarak sabitlenir; mobilde yükseklik sınırlıdır.",
  },
  BLOCK: {
    title: "Normal blok",
    hint: "Çerçeveli, sade blok; ekstra yapışkanlık yok.",
  },
};
