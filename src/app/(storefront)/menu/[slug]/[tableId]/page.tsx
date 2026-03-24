import React from "react";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getProductMenuVisibilityWhere } from "@/lib/product-visibility";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { getValidTableSession } from "@/lib/table-session";
import { getTenantCustomerPaymentMethods } from "@/lib/payment-methods";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { evaluateRestaurantOrderingAvailability } from "@/lib/restaurant-working-hours";
import RefreshPolling from "@/components/refresh-polling";
import MenuClient from "./menu-client";
import { resolveStorefrontMenuShowcases } from "@/lib/storefront-menu-showcase-resolve";

export const dynamic = "force-dynamic";

const getMenuData = async (tableId: string) => {
  const { tenantId: contextTenantId } = await getCurrentTenantOrThrow();
  const supportsRestaurantWorkingHours = prismaModelHasField("Restaurant", "workingHours");
  const supportsMenuFontSize = prismaModelHasField("Restaurant", "menuFontSizePx");
  const supportsMenuTextColor = prismaModelHasField("Restaurant", "menuTextColor");
  const supportsMenuBackgroundColor = prismaModelHasField("Restaurant", "menuBackgroundColor");
  const supportsMenuButtonBackgroundColor = prismaModelHasField(
    "Restaurant",
    "menuButtonBackgroundColor",
  );
  const supportsMenuHeaderBackgroundColor = prismaModelHasField(
    "Restaurant",
    "menuHeaderBackgroundColor",
  );

  const session = await getValidTableSession();
  if (!session) {
    return null;
  }

  const urlTableId = parseInt(tableId, 10);
  if (Number.isNaN(urlTableId)) {
    return null;
  }

  if (urlTableId !== session.tableId) {
    return null;
  }

  if (session.tenantId !== contextTenantId) {
    return null;
  }

  const table = await prisma.table.findFirst({
    where: {
      id: session.tableId,
      restaurant: { tenantId: session.tenantId },
    },
    select: {
      restaurantId: true,
      restaurant: {
        select: {
          name: true,
          logoUrl: true,
          themeColor: true,
          ...(supportsMenuFontSize ? { menuFontSizePx: true } : {}),
          ...(supportsMenuTextColor ? { menuTextColor: true } : {}),
          ...(supportsMenuBackgroundColor ? { menuBackgroundColor: true } : {}),
          ...(supportsMenuButtonBackgroundColor
            ? { menuButtonBackgroundColor: true }
            : {}),
          ...(supportsMenuHeaderBackgroundColor
            ? { menuHeaderBackgroundColor: true }
            : {}),
          openingHour: true,
          closingHour: true,
          orderingDisabled: true,
          ...(supportsRestaurantWorkingHours
            ? {
                workingHours: {
                  select: {
                    weekday: true,
                    isOpen: true,
                    openTime: true,
                    closeTime: true,
                  },
                },
              }
            : {}),
          locationEnforcementEnabled: true,
          orderRadiusMeters: true,
          locationLatitude: true,
          locationLongitude: true,
        },
      },
    },
  });
  if (!table) {
    return null;
  }

  const [paymentMethods, billingSnapshot] = await Promise.all([
    getTenantCustomerPaymentMethods(session.tenantId),
    getTableBillingSnapshot({
      tenantId: session.tenantId,
      tableId: session.tableId,
    }),
  ]);

  const activeMenu = await prisma.menu.findFirst({
    where: {
      tenantId: session.tenantId,
      isActive: true,
      OR: [{ restaurantId: table.restaurantId }, { restaurantId: null }],
    },
    orderBy: [{ restaurantId: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  const orderingAvailability = evaluateRestaurantOrderingAvailability({
    orderingDisabled: table.restaurant.orderingDisabled,
    weeklyHours: supportsRestaurantWorkingHours
      ? ((table.restaurant as { workingHours?: unknown[] }).workingHours ?? []) as {
          weekday:
            | "MONDAY"
            | "TUESDAY"
            | "WEDNESDAY"
            | "THURSDAY"
            | "FRIDAY"
            | "SATURDAY"
            | "SUNDAY";
          isOpen: boolean;
          openTime: string | null;
          closeTime: string | null;
        }[]
      : [],
    openingHour: table.restaurant.openingHour,
    closingHour: table.restaurant.closingHour,
  });
  const orderingClosed = !orderingAvailability.isOpen;

  if (!activeMenu) {
    return {
      restaurant: {
        name: table.restaurant.name,
        logoUrl: table.restaurant.logoUrl,
        themeColor: table.restaurant.themeColor ?? "primary",
        menuFontSizePx: supportsMenuFontSize
          ? (table.restaurant as { menuFontSizePx?: number | null }).menuFontSizePx ?? null
          : null,
        menuTextColor: supportsMenuTextColor
          ? (table.restaurant as { menuTextColor?: string | null }).menuTextColor ?? null
          : null,
        menuBackgroundColor: supportsMenuBackgroundColor
          ? (table.restaurant as { menuBackgroundColor?: string | null }).menuBackgroundColor ?? null
          : null,
        menuButtonBackgroundColor: supportsMenuButtonBackgroundColor
          ? (table.restaurant as { menuButtonBackgroundColor?: string | null })
              .menuButtonBackgroundColor ?? null
          : null,
        menuHeaderBackgroundColor: supportsMenuHeaderBackgroundColor
          ? (table.restaurant as { menuHeaderBackgroundColor?: string | null })
              .menuHeaderBackgroundColor ?? null
          : null,
        orderingClosed,
        openingHour: orderingAvailability.todayOpeningHour,
        closingHour: orderingAvailability.todayClosingHour,
        canRequestBill: billingSnapshot.canRequestBill,
        unpaidTotal: billingSnapshot.totalUnpaid,
        locationEnforcementEnabled: table.restaurant.locationEnforcementEnabled,
        orderRadiusMeters: table.restaurant.orderRadiusMeters,
        locationLatitude:
          table.restaurant.locationLatitude != null
            ? Number(table.restaurant.locationLatitude)
            : null,
        locationLongitude:
          table.restaurant.locationLongitude != null
            ? Number(table.restaurant.locationLongitude)
            : null,
      },
      categories: [],
      products: [],
      tableId,
      paymentMethods: {
        cash: paymentMethods.cash,
        creditCard: paymentMethods.creditCard,
        iyzico: paymentMethods.iyzico,
      },
    };
  }

  const now = new Date();

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      id: table.restaurantId,
      tenantId: session.tenantId,
    },
    include: {
      categories: {
        where: { menuId: activeMenu.id },
        orderBy: { id: "asc" },
        include: {
          products: {
            where: getProductMenuVisibilityWhere(now),
            orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
            include: {
              optionGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  options: {
                    where: { isActive: true },
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

  if (!restaurant) {
    return null;
  }

  const categoriesWithProducts = restaurant.categories
    .filter((category) => category.products.length > 0)
    .map((category) => ({
    id: category.id,
    nameTR: category.nameTR,
    nameEN: category.nameEN,
    products: category.products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      nameTR: product.nameTR,
      nameEN: product.nameEN,
      descriptionTR: product.descriptionTR,
      descriptionEN: product.descriptionEN,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      trackStock: (product as { trackStock?: boolean }).trackStock ?? false,
      stockQuantity: Number(
        (product as { stockQuantity?: number | null }).stockQuantity ?? 0,
      ),
      optionGroups: product.optionGroups.map((g) => ({
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
          priceDelta: o.priceDelta ? o.priceDelta.toNumber() : 0,
        })),
      })),
      isFeatured: product.isFeatured,
    })),
  }));

  const flatProducts = restaurant.categories.flatMap((category) =>
    category.products.map((product) => ({
      id: product.id,
      categoryId: product.categoryId,
      nameTR: product.nameTR,
      nameEN: product.nameEN,
      descriptionTR: product.descriptionTR,
      descriptionEN: product.descriptionEN,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
      trackStock: (product as { trackStock?: boolean }).trackStock ?? false,
      stockQuantity: Number(
        (product as { stockQuantity?: number | null }).stockQuantity ?? 0,
      ),
      optionGroups: product.optionGroups.map((g) => ({
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
          priceDelta: o.priceDelta ? o.priceDelta.toNumber() : 0,
        })),
      })),
    })),
  );

  const [popularShowcaseRows, frequentShowcaseRow] = await Promise.all([
    prisma.menuPopularShowcase.findMany({
      where: { menuId: activeMenu.id, isEnabled: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.menuFrequentShowcase.findUnique({
      where: { menuId: activeMenu.id, isEnabled: true },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  const { popularByCategory, frequentShowcase } = resolveStorefrontMenuShowcases({
    flatProducts,
    popularRows: popularShowcaseRows.map((r) => ({
      categoryId: r.categoryId,
      title: r.title,
      subtitle: r.subtitle,
      autoplayEnabled: r.autoplayEnabled,
      autoplaySpeed: r.autoplaySpeed === "NORMAL" ? "NORMAL" : "SLOW",
      items: r.items,
    })),
    frequentRow: frequentShowcaseRow
      ? {
          title: frequentShowcaseRow.title,
          subtitle: frequentShowcaseRow.subtitle,
          placement: frequentShowcaseRow.placement,
          items: frequentShowcaseRow.items,
        }
      : null,
  });

  return {
    restaurant: {
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      themeColor: restaurant.themeColor ?? "primary",
      menuFontSizePx: restaurant.menuFontSizePx,
      menuTextColor: restaurant.menuTextColor,
      menuBackgroundColor: restaurant.menuBackgroundColor,
      menuButtonBackgroundColor: restaurant.menuButtonBackgroundColor,
      menuHeaderBackgroundColor: restaurant.menuHeaderBackgroundColor,
      orderingClosed,
      openingHour: orderingAvailability.todayOpeningHour,
      closingHour: orderingAvailability.todayClosingHour,
      canRequestBill: billingSnapshot.canRequestBill,
      unpaidTotal: billingSnapshot.totalUnpaid,
      locationEnforcementEnabled: restaurant.locationEnforcementEnabled,
      orderRadiusMeters: restaurant.orderRadiusMeters,
      locationLatitude:
        restaurant.locationLatitude != null
          ? Number(restaurant.locationLatitude)
          : null,
      locationLongitude:
        restaurant.locationLongitude != null
          ? Number(restaurant.locationLongitude)
          : null,
    },
    categories: categoriesWithProducts,
    products: flatProducts,
    popularByCategory,
    frequentShowcase,
    tableId,
    paymentMethods: {
      cash: paymentMethods.cash,
      creditCard: paymentMethods.creditCard,
      iyzico: paymentMethods.iyzico,
    },
  };
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { tableId } = await params;
  const data = await getMenuData(tableId);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        Masa oturumu bulunamadı. Lütfen masadaki QR kodu yeniden okutun.
      </div>
    );
  }

  return (
    <>
      <RefreshPolling intervalMs={30000} />
      <MenuClient data={data} />
    </>
  );
}
