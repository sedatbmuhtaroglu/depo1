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
import { getTenantEntitlements } from "@/core/entitlements/engine";
import {
  canManageMenuComplianceFromFeatures,
  resolveStorefrontFeatureAccess,
} from "@/lib/restaurant-panel-access";
import {
  buildOrderItemAdjustmentMap,
  getEffectiveOrderItemQuantity,
} from "@/lib/order-item-effective";

export const dynamic = "force-dynamic";

function buildOrderAdjustmentsMaps(
  cancellations: Array<{ orderId: number; productId: number; quantity: number }>,
  cashAdjustments: Array<{ orderId: number; productId: number; adjustedQuantity: number }>,
) {
  const cancellationMap = buildOrderItemAdjustmentMap(cancellations);
  const cashAdjustmentMap = buildOrderItemAdjustmentMap(
    cashAdjustments.map((row) => ({
      orderId: row.orderId,
      productId: row.productId,
      quantity: row.adjustedQuantity,
    })),
  );
  return { cancellationMap, cashAdjustmentMap };
}

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

  const entitlements = await getTenantEntitlements(session.tenantId);
  const qrMenuEnabled = entitlements.features.has("QR_MENU_VIEW");
  const storefrontAccess = resolveStorefrontFeatureAccess(
    new Set(Array.from(entitlements.features)),
  );
  const menuComplianceVisible = canManageMenuComplianceFromFeatures(
    new Set(Array.from(entitlements.features)),
  );
  const qrOrderingEnabled = storefrontAccess.orderingEnabled;
  const showcaseEnabled = entitlements.features.has("SHOWCASE_RAILS");

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

  if (!qrMenuEnabled) {
    return {
      accessDeniedMessage: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      restaurant: {
        name: table.restaurant.name,
        logoUrl: table.restaurant.logoUrl,
        orderingClosed: true,
        orderingFeatureEnabled: false,
        openingHour: null,
        closingHour: null,
        paymentMethods: {
          cash: paymentMethods.cash,
          creditCard: paymentMethods.creditCard,
          iyzico: paymentMethods.iyzico,
        },
        waiterCallFeatureEnabled: storefrontAccess.waiterCallEnabled,
        billRequestFeatureEnabled: storefrontAccess.billRequestEnabled,
        menuComplianceVisible,
        canRequestBill: false,
        unpaidTotal: 0,
        locationEnforcementEnabled: false,
        orderRadiusMeters: undefined,
        locationLatitude: null,
        locationLongitude: null,
      },
      categories: [],
      tableId,
      myOrders: [],
    };
  }
  const customerOrderWhere = {
    tableId: session.tableId,
    ...(billingSnapshot.cycleStartAt
      ? {
          OR: [
            { createdAt: { gt: billingSnapshot.cycleStartAt } },
            { readyAt: { gt: billingSnapshot.cycleStartAt } },
            { deliveredAt: { gt: billingSnapshot.cycleStartAt } },
          ],
        }
      : {}),
  };

  const activeMenu = await prisma.menu.findFirst({
    where: {
      tenantId: session.tenantId,
      isActive: true,
      OR: [{ restaurantId: table.restaurantId }, { restaurantId: null }],
    },
    orderBy: [{ restaurantId: "desc" }, { id: "asc" }],
    select: { id: true },
  });

  const restaurantFromTable = table.restaurant;
  const weeklyHours = supportsRestaurantWorkingHours
    ? ((restaurantFromTable as { workingHours?: unknown[] }).workingHours ?? [])
    : [];
  const orderingAvailability = evaluateRestaurantOrderingAvailability({
    orderingDisabled: restaurantFromTable.orderingDisabled,
    weeklyHours: weeklyHours as {
      weekday: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
      isOpen: boolean;
      openTime: string | null;
      closeTime: string | null;
    }[],
    openingHour: restaurantFromTable.openingHour,
    closingHour: restaurantFromTable.closingHour,
  });
  const orderingClosed = !orderingAvailability.isOpen;

  if (!activeMenu) {
    const tableOrders = await prisma.order.findMany({
      where: customerOrderWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, createdAt: true, note: true, items: true },
    });
    const orderIds = tableOrders.map((order) => order.id);
    const [cancellations, cashAdjustments] = await Promise.all([
      orderIds.length > 0
        ? prisma.orderItemCancellation.findMany({
            where: { tenantId: session.tenantId, orderId: { in: orderIds } },
            select: { orderId: true, productId: true, quantity: true },
          })
        : Promise.resolve([]),
      orderIds.length > 0
        ? prisma.cashOrderAdjustment.findMany({
            where: { tenantId: session.tenantId, orderId: { in: orderIds } },
            select: { orderId: true, productId: true, adjustedQuantity: true },
          })
        : Promise.resolve([]),
    ]);
    const { cancellationMap, cashAdjustmentMap } = buildOrderAdjustmentsMaps(
      cancellations,
      cashAdjustments,
    );

    const productIds = new Set<number>();
    for (const o of tableOrders) {
      const items = (o.items as { productId: number }[]) ?? [];
      for (const it of items) productIds.add(it.productId);
    }
    const productList =
      productIds.size > 0
        ? await prisma.product.findMany({
            where: { id: { in: [...productIds] } },
            select: { id: true, nameTR: true, nameEN: true },
          })
        : [];
    const productNameMap = new Map(
      productList.map((p) => [p.id, { nameTR: p.nameTR, nameEN: p.nameEN }]),
    );

    const statusLabels: Record<string, string> = {
      PENDING_WAITER_APPROVAL: "Onay bekliyor",
      PENDING: "Sırada",
      PREPARING: "Hazırlanıyor",
      COMPLETED: "Tamamlandı",
      REJECTED: "Reddedildi",
    };

    const myOrders = tableOrders.map((o) => {
      const items = (o.items as { productId: number; quantity: number; price: number }[]) ?? [];
      return {
        id: o.id,
        status: o.status,
        statusLabel: statusLabels[o.status] ?? o.status,
        createdAt: o.createdAt.toISOString(),
        note: o.note ?? null,
        items: items
          .map((it) => {
            const names = productNameMap.get(it.productId);
            const effectiveQuantity = getEffectiveOrderItemQuantity({
              orderId: o.id,
              productId: it.productId,
              originalQuantity: it.quantity,
              cancellationMap,
              cashAdjustmentMap,
            });
            if (effectiveQuantity <= 0) return null;

            return {
              productName: names?.nameTR ?? "-",
              productNameEN: names?.nameEN ?? null,
              quantity: effectiveQuantity,
              price: Number(it.price),
            };
          })
          .filter((item): item is { productName: string; productNameEN: string | null; quantity: number; price: number } => item !== null),
      };
    }).filter((order) => order.items.length > 0);

    return {
      restaurant: {
        name: restaurantFromTable.name,
        logoUrl: restaurantFromTable.logoUrl,
        orderingClosed: Boolean(orderingClosed),
        orderingFeatureEnabled: qrOrderingEnabled,
        openingHour: orderingAvailability.todayOpeningHour,
        closingHour: orderingAvailability.todayClosingHour,
        themeColor: restaurantFromTable.themeColor ?? "primary",
        menuFontSizePx: supportsMenuFontSize
          ? (restaurantFromTable as { menuFontSizePx?: number | null }).menuFontSizePx ?? null
          : null,
        menuTextColor: supportsMenuTextColor
          ? (restaurantFromTable as { menuTextColor?: string | null }).menuTextColor ?? null
          : null,
        menuBackgroundColor: supportsMenuBackgroundColor
          ? (restaurantFromTable as { menuBackgroundColor?: string | null }).menuBackgroundColor ??
            null
          : null,
        menuButtonBackgroundColor: supportsMenuButtonBackgroundColor
          ? (restaurantFromTable as { menuButtonBackgroundColor?: string | null })
              .menuButtonBackgroundColor ?? null
          : null,
        menuHeaderBackgroundColor: supportsMenuHeaderBackgroundColor
          ? (restaurantFromTable as { menuHeaderBackgroundColor?: string | null })
              .menuHeaderBackgroundColor ?? null
          : null,
        locationEnforcementEnabled: restaurantFromTable.locationEnforcementEnabled,
        orderRadiusMeters: restaurantFromTable.orderRadiusMeters,
        locationLatitude:
          restaurantFromTable.locationLatitude != null
            ? Number(restaurantFromTable.locationLatitude)
            : null,
        locationLongitude:
          restaurantFromTable.locationLongitude != null
            ? Number(restaurantFromTable.locationLongitude)
            : null,
        paymentMethods: {
          cash: paymentMethods.cash,
          creditCard: paymentMethods.creditCard,
          iyzico: paymentMethods.iyzico,
        },
        waiterCallFeatureEnabled: storefrontAccess.waiterCallEnabled,
        billRequestFeatureEnabled: storefrontAccess.billRequestEnabled,
        menuComplianceVisible,
        canRequestBill: billingSnapshot.canRequestBill,
        unpaidTotal: billingSnapshot.totalUnpaid,
      },
      categories: [],
      accessDeniedMessage: null,
      tableId,
      myOrders,
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
              complianceInfo: true,
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
      optionGroups: product.optionGroups.map((group) => ({
        id: group.id,
        nameTR: group.nameTR,
        nameEN: group.nameEN,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        isRequired: group.isRequired,
        options: group.options.map((option) => ({
          id: option.id,
          nameTR: option.nameTR,
          nameEN: option.nameEN,
          priceDelta: option.priceDelta ? option.priceDelta.toNumber() : 0,
        })),
      })),
      isFeatured: product.isFeatured,
      complianceInfo: product.complianceInfo
        ? {
            basicIngredients: product.complianceInfo.basicIngredients,
            caloriesKcal: product.complianceInfo.caloriesKcal,
            allergens: product.complianceInfo.allergens,
            customAllergens: product.complianceInfo.customAllergens,
            alcoholStatus: product.complianceInfo.alcoholStatus,
            porkStatus: product.complianceInfo.porkStatus,
            crossContaminationNote: product.complianceInfo.crossContaminationNote,
          }
        : null,
    })),
  }));

  const flatProductsForShowcase = categoriesWithProducts.flatMap((c) => c.products);

  const [popularShowcaseRows, frequentShowcaseRow] = showcaseEnabled
    ? await Promise.all([
        prisma.menuPopularShowcase.findMany({
          where: { menuId: activeMenu.id, isEnabled: true },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        }),
        prisma.menuFrequentShowcase.findUnique({
          where: { menuId: activeMenu.id, isEnabled: true },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        }),
      ])
    : [[], null];

  const { popularByCategory, frequentShowcase } = resolveStorefrontMenuShowcases({
    flatProducts: flatProductsForShowcase,
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

  const tableOrders = await prisma.order.findMany({
    where: customerOrderWhere,
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, status: true, createdAt: true, note: true, items: true },
  });
  const orderIds = tableOrders.map((order) => order.id);
  const [cancellations, cashAdjustments] = await Promise.all([
    orderIds.length > 0
      ? prisma.orderItemCancellation.findMany({
          where: { tenantId: session.tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, quantity: true },
        })
      : Promise.resolve([]),
    orderIds.length > 0
      ? prisma.cashOrderAdjustment.findMany({
          where: { tenantId: session.tenantId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, adjustedQuantity: true },
        })
      : Promise.resolve([]),
  ]);
  const { cancellationMap, cashAdjustmentMap } = buildOrderAdjustmentsMaps(
    cancellations,
    cashAdjustments,
  );

  const productIds = new Set<number>();
  for (const o of tableOrders) {
    const items = (o.items as { productId: number }[]) ?? [];
    for (const it of items) productIds.add(it.productId);
  }
  const productList =
    productIds.size > 0
      ? await prisma.product.findMany({
          where: { id: { in: [...productIds] } },
          select: { id: true, nameTR: true, nameEN: true },
        })
      : [];
  const productNameMap = new Map(
    productList.map((p) => [p.id, { nameTR: p.nameTR, nameEN: p.nameEN }]),
  );

  const statusLabels: Record<string, string> = {
    PENDING_WAITER_APPROVAL: "Onay bekliyor",
    PENDING: "Sırada",
    PREPARING: "Hazırlanıyor",
    COMPLETED: "Tamamlandı",
    REJECTED: "Reddedildi",
  };

  const myOrders = tableOrders.map((o) => {
    const items = (o.items as { productId: number; quantity: number; price: number }[]) ?? [];
    return {
      id: o.id,
      status: o.status,
      statusLabel: statusLabels[o.status] ?? o.status,
      createdAt: o.createdAt.toISOString(),
      note: o.note ?? null,
      items: items
        .map((it) => {
          const names = productNameMap.get(it.productId);
          const effectiveQuantity = getEffectiveOrderItemQuantity({
            orderId: o.id,
            productId: it.productId,
            originalQuantity: it.quantity,
            cancellationMap,
            cashAdjustmentMap,
          });
          if (effectiveQuantity <= 0) return null;

          return {
            productName: names?.nameTR ?? "-",
            productNameEN: names?.nameEN ?? null,
            quantity: effectiveQuantity,
            price: Number(it.price),
          };
        })
        .filter((item): item is { productName: string; productNameEN: string | null; quantity: number; price: number } => item !== null),
    };
  }).filter((order) => order.items.length > 0);

  return {
    restaurant: {
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      orderingClosed: Boolean(orderingClosed),
      orderingFeatureEnabled: qrOrderingEnabled,
      openingHour: orderingAvailability.todayOpeningHour,
      closingHour: orderingAvailability.todayClosingHour,
      themeColor: restaurant.themeColor ?? "primary",
      menuFontSizePx: restaurant.menuFontSizePx,
      menuTextColor: restaurant.menuTextColor,
      menuBackgroundColor: restaurant.menuBackgroundColor,
      menuButtonBackgroundColor: restaurant.menuButtonBackgroundColor,
      menuHeaderBackgroundColor: restaurant.menuHeaderBackgroundColor,
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
      paymentMethods: {
        cash: paymentMethods.cash,
        creditCard: paymentMethods.creditCard,
        iyzico: paymentMethods.iyzico,
      },
      waiterCallFeatureEnabled: storefrontAccess.waiterCallEnabled,
      billRequestFeatureEnabled: storefrontAccess.billRequestEnabled,
      menuComplianceVisible,
      canRequestBill: billingSnapshot.canRequestBill,
      unpaidTotal: billingSnapshot.totalUnpaid,
    },
    categories: categoriesWithProducts,
    accessDeniedMessage: null,
    popularByCategory,
    frequentShowcase,
    tableId,
    myOrders,
  };
};

export default async function MenuPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
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

  if (data.accessDeniedMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        {data.accessDeniedMessage}
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
