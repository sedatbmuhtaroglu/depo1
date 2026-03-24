import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import MenuManager from "./menu-manager";
import { getTenantLimitUsageSummary } from "@/lib/tenant-limits";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";

export const dynamic = "force-dynamic";

type RestaurantMenuPageProps = {
  searchParams?: Promise<{
    menuId?: string;
  }>;
};

export default async function RestaurantMenuPage({ searchParams }: RestaurantMenuPageProps) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedMenuParam = resolvedSearchParams.menuId;

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

  const [restaurants, limitSummary] = await Promise.all([
    prisma.restaurant.findMany({
      where: { tenantId },
      include: {
        categories: {
          where:
            selectedMenuId === null
              ? { menuId: null }
              : { menuId: selectedMenuId },
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
    }),
    getTenantLimitUsageSummary(tenantId),
  ]);

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

  const menusUsageText =
    limitSummary.usage.menus.max == null
      ? `${limitSummary.usage.menus.used}/∞`
      : `${limitSummary.usage.menus.used}/${limitSummary.usage.menus.max}`;

  const productsUsageText =
    limitSummary.usage.products.max == null
      ? `${limitSummary.usage.products.used}/∞`
      : `${limitSummary.usage.products.used}/${limitSummary.usage.products.max}`;

  const categoryCount = categories.length;
  const productCount = categories.reduce((acc, category) => acc + category.products.length, 0);
  const menuCount = menus.length;
  const activeMenuName = activeMenu?.name ?? "Aktif menü yok";

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B7280]">
              Menü Yönetimi
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Kategori ve Ürün Düzenleme</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Menü kullanımı: {menusUsageText} • Ürün kullanımı: {productsUsageText}
            </p>
          </div>

          <span className={badgeClasses("neutral", "px-2.5 py-1 text-xs font-medium")}>
            Aktif Menü: <span className="ml-1 font-semibold text-[#111827]">{activeMenuName}</span>
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Menü Sayısı</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{menuCount}</p>
          </div>
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Kategori</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{categoryCount}</p>
          </div>
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Ürün</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{productCount}</p>
          </div>
        </div>
      </section>
      <MenuManager
        restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))}
        menus={menus}
        selectedMenuId={selectedMenuId}
        categories={categories}
      />
    </div>
  );
}
