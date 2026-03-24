import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import type { MenuFrequentShowcasePlacement, MenuShowcaseAutoplaySpeed } from "@prisma/client";

export type ShowcaseCategoryRow = {
  id: number;
  nameTR: string;
  products: Array<{
    id: number;
    categoryId: number;
    nameTR: string;
    isActive: boolean;
    visibleFrom: string | null;
    visibleUntil: string | null;
  }>;
};

export type PopularInitialRow = {
  categoryId: number;
  title: string;
  subtitle: string | null;
  isEnabled: boolean;
  productIds: number[];
  autoplayEnabled: boolean;
  autoplaySpeed: MenuShowcaseAutoplaySpeed;
};

export type FrequentInitial = {
  title: string;
  subtitle: string | null;
  isEnabled: boolean;
  productIds: number[];
  placement: MenuFrequentShowcasePlacement;
};

export async function getShowcaseAdminData(searchParams?: { menuId?: string }) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const selectedMenuParam = searchParams?.menuId;

  const menus = await prisma.menu.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      isActive: true,
      restaurantId: true,
    },
  });

  const activeMenu = menus.find((m) => m.isActive) ?? null;
  const selectedMenuId =
    selectedMenuParam &&
    !Number.isNaN(Number(selectedMenuParam)) &&
    menus.some((m) => m.id === Number(selectedMenuParam))
      ? Number(selectedMenuParam)
      : activeMenu?.id ?? null;

  const restaurants = await prisma.restaurant.findMany({
    where: { tenantId },
    include: {
      categories: {
        where:
          selectedMenuId === null ? { menuId: null } : { menuId: selectedMenuId },
        orderBy: { id: "asc" },
        include: {
          products: {
            orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
            include: {
              optionGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  options: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (restaurants.length === 0) redirect("/restaurant");

  const categories = restaurants.flatMap((r) =>
    r.categories.map((c) => ({
      id: c.id,
      nameTR: c.nameTR,
      nameEN: c.nameEN,
      restaurantId: r.id,
      menuId: c.menuId,
      products: c.products.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        nameTR: p.nameTR,
        nameEN: p.nameEN,
        descriptionTR: p.descriptionTR,
        descriptionEN: p.descriptionEN,
        price: p.price.toString(),
        imageUrl: p.imageUrl,
        isAvailable: p.isAvailable,
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        sortOrder: p.sortOrder,
        trackStock: (p as { trackStock?: boolean }).trackStock ?? false,
        stockQuantity: Number((p as { stockQuantity?: number | null }).stockQuantity ?? 0),
        visibleFrom: p.visibleFrom ? p.visibleFrom.toISOString() : null,
        visibleUntil: p.visibleUntil ? p.visibleUntil.toISOString() : null,
        tags: p.tags as string[] | null,
        options: p.options,
        optionGroups: p.optionGroups.map((g) => ({
          id: g.id,
          nameTR: g.nameTR,
          nameEN: g.nameEN,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          isRequired: g.isRequired,
          options: g.options.map((o) => ({
            id: o.id,
            nameTR: o.nameTR,
            nameEN: o.nameEN,
            priceDelta: o.priceDelta ? o.priceDelta.toString() : null,
            isActive: o.isActive,
          })),
        })),
      })),
    })),
  );

  const [popularShowcases, frequentShowcase] =
    selectedMenuId !== null
      ? await Promise.all([
          prisma.menuPopularShowcase.findMany({
            where: { menuId: selectedMenuId },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          }),
          prisma.menuFrequentShowcase.findUnique({
            where: { menuId: selectedMenuId },
            include: { items: { orderBy: { sortOrder: "asc" } } },
          }),
        ])
      : [[], null];

  const showcasePopularInitial: PopularInitialRow[] = popularShowcases.map((s) => ({
    categoryId: s.categoryId,
    title: s.title,
    subtitle: s.subtitle,
    isEnabled: s.isEnabled,
    productIds: s.items.map((i) => i.productId),
    autoplayEnabled: s.autoplayEnabled,
    autoplaySpeed: s.autoplaySpeed,
  }));

  const showcaseFrequentInitial: FrequentInitial | null = frequentShowcase
    ? {
        title: frequentShowcase.title,
        subtitle: frequentShowcase.subtitle,
        isEnabled: frequentShowcase.isEnabled,
        productIds: frequentShowcase.items.map((i) => i.productId),
        placement: frequentShowcase.placement,
      }
    : null;

  const showcaseCategories: ShowcaseCategoryRow[] = categories.map((c) => ({
    id: c.id,
    nameTR: c.nameTR,
    products: c.products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      nameTR: p.nameTR,
      isActive: p.isActive,
      visibleFrom: p.visibleFrom,
      visibleUntil: p.visibleUntil,
    })),
  }));

  return {
    tenantId,
    menus,
    activeMenu,
    selectedMenuId,
    categories,
    showcaseCategories,
    popularInitial: showcasePopularInitial,
    frequentInitial: showcaseFrequentInitial,
  };
}
