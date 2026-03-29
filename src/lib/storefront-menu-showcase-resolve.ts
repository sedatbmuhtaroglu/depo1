/**
 * Sunucuda menü ürün listesi ile vitrin satırlarını birleştirir.
 * Silinmiş / görünür olmayan ürünler listede yoksa vitrin satırından düşer.
 */

export type StorefrontAutoplaySpeed = "SLOW" | "NORMAL";

export type StorefrontFrequentPlacement =
  | "ABOVE_CATEGORIES"
  | "BELOW_CATEGORIES"
  | "STICKY"
  | "BLOCK";

export function resolveStorefrontMenuShowcases<T extends { id: number }>(input: {
  flatProducts: T[];
  popularRows: Array<{
    categoryId: number;
    title: string;
    subtitle: string | null;
    autoplayEnabled: boolean;
    autoplaySpeed: StorefrontAutoplaySpeed;
    items: { productId: number }[];
  }>;
  frequentRow: {
    title: string;
    subtitle: string | null;
    placement: StorefrontFrequentPlacement;
    items: { productId: number }[];
  } | null;
}): {
  popularByCategory: Record<
    number,
    {
      title: string;
      subtitle: string | null;
      products: T[];
      autoplayEnabled: boolean;
      autoplaySpeed: StorefrontAutoplaySpeed;
    }
  >;
  frequentShowcase: {
    title: string;
    subtitle: string | null;
    products: T[];
    placement: StorefrontFrequentPlacement;
  } | null;
} {
  const productById = new Map(input.flatProducts.map((p) => [p.id, p]));
  const popularByCategory: Record<
    number,
    {
      title: string;
      subtitle: string | null;
      products: T[];
      autoplayEnabled: boolean;
      autoplaySpeed: StorefrontAutoplaySpeed;
    }
  > = {};

  for (const row of input.popularRows) {
    const products = row.items
      .map((i) => productById.get(i.productId))
      .filter((p): p is T => p != null);
    if (products.length === 0) continue;
    popularByCategory[row.categoryId] = {
      title: row.title,
      subtitle: row.subtitle,
      products,
      autoplayEnabled: row.autoplayEnabled,
      autoplaySpeed: row.autoplaySpeed,
    };
  }

  if (!input.frequentRow) {
    return { popularByCategory, frequentShowcase: null };
  }

  const fProducts = input.frequentRow.items
    .map((i) => productById.get(i.productId))
    .filter((p): p is T => p != null);

  if (fProducts.length === 0) {
    return { popularByCategory, frequentShowcase: null };
  }

  return {
    popularByCategory,
    frequentShowcase: {
      title: input.frequentRow.title,
      subtitle: input.frequentRow.subtitle,
      products: fProducts,
      placement: input.frequentRow.placement,
    },
  };
}
