import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import MenuManager from "./menu-manager";
import { getTenantLimitUsageSummary } from "@/lib/tenant-limits";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import { getTenantEntitlements } from "@/core/entitlements/engine";
import { canManageMenuComplianceFromFeatures } from "@/lib/restaurant-panel-access";

export const dynamic = "force-dynamic";

type RestaurantMenuPageProps = {
  searchParams?: Promise<{
    menuId?: string;
  }>;
};

export default async function RestaurantMenuPage({ searchParams }: RestaurantMenuPageProps) {
  const { tenantId } = await getCurrentTenantOrThrow();
  const entitlements = await getTenantEntitlements(tenantId);
  const canManageMenuCompliance = canManageMenuComplianceFromFeatures(
    new Set(Array.from(entitlements.features)),
  );
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
                complianceInfo: true,
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
  const tenantAllergens = await prisma.tenantAllergen.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
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
        complianceInfo: p.complianceInfo
          ? {
              basicIngredients: p.complianceInfo.basicIngredients,
              caloriesKcal: p.complianceInfo.caloriesKcal,
              allergens: p.complianceInfo.allergens,
              customAllergens: p.complianceInfo.customAllergens,
              alcoholStatus: p.complianceInfo.alcoholStatus,
              porkStatus: p.complianceInfo.porkStatus,
              crossContaminationNote: p.complianceInfo.crossContaminationNote,
            }
          : null,
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
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-4 shadow-none sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="rm-section-intro-eyebrow">Menü Yönetimi</p>
            <h2 className="rm-section-intro-title">Kategori ve Ürün Düzenleme</h2>
            <p className="rm-section-intro-desc">
              Menü kullanımı: {menusUsageText} • Ürün kullanımı: {productsUsageText}
            </p>
          </div>

          <span className={badgeClasses("neutral", "max-w-full shrink-0 px-2.5 py-1 text-xs font-medium")}>
            Aktif Menü:{" "}
            <span className="ml-1 font-semibold text-[color:var(--ui-text-primary)]">{activeMenuName}</span>
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Menü Sayısı</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{menuCount}</p>
          </div>
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Kategori</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{categoryCount}</p>
          </div>
          <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
            <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Ürün</p>
            <p className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">{productCount}</p>
          </div>
        </div>
      </section>
      <MenuManager
        restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))}
        menus={menus}
        selectedMenuId={selectedMenuId}
        categories={categories}
        tenantAllergens={tenantAllergens}
        canManageMenuCompliance={canManageMenuCompliance}
      />
    </div>
  );
}
