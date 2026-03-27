import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getProductMenuVisibilityWhere } from "@/lib/product-visibility";
import { getTenantEntitlements } from "@/core/entitlements/engine";
import {
  canManageMenuComplianceFromFeatures,
  resolveStorefrontFeatureAccess,
} from "@/lib/restaurant-panel-access";
import { evaluateRestaurantOrderingAvailability } from "@/lib/restaurant-working-hours";
import type {
  ProductAllergenValue,
  ProductComplianceStatusValue,
} from "@/lib/product-compliance";

export type StorefrontPublicMenuProduct = {
  id: number;
  categoryId: number;
  nameTR: string;
  nameEN: string | null;
  descriptionTR: string | null;
  descriptionEN: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  trackStock: boolean;
  stockQuantity: number;
  complianceInfo: {
    basicIngredients: string | null;
    caloriesKcal: number | null;
    allergens: ProductAllergenValue[] | null;
    customAllergens: string[] | null;
    alcoholStatus: ProductComplianceStatusValue | null;
    porkStatus: ProductComplianceStatusValue | null;
    crossContaminationNote: string | null;
  } | null;
};

export type StorefrontPublicMenuCategory = {
  id: number;
  nameTR: string;
  nameEN: string | null;
  products: StorefrontPublicMenuProduct[];
};

export type StorefrontPublicMenuData = {
  restaurant: {
    id: number;
    name: string;
    logoUrl: string | null;
    themeColor: "primary" | "secondary";
    menuFontSizePx: number | null;
    menuTextColor: string | null;
    menuBackgroundColor: string | null;
    menuButtonBackgroundColor: string | null;
    menuHeaderBackgroundColor: string | null;
    openingHour: string | null;
    closingHour: string | null;
    orderingClosed: boolean;
    menuComplianceVisible: boolean;
    orderingFeatureEnabled: boolean;
  };
  categories: StorefrontPublicMenuCategory[];
  hasPublishedMenu: boolean;
};

export async function getStorefrontPublicMenuData(params: {
  tenantId: number;
  restaurantId?: number;
}): Promise<StorefrontPublicMenuData | null> {
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

  const entitlements = await getTenantEntitlements(params.tenantId);
  const storefrontAccess = resolveStorefrontFeatureAccess(
    new Set(Array.from(entitlements.features)),
  );
  const menuComplianceVisible = canManageMenuComplianceFromFeatures(
    new Set(Array.from(entitlements.features)),
  );

  const restaurant = await prisma.restaurant.findFirst({
    where: {
      tenantId: params.tenantId,
      ...(params.restaurantId ? { id: params.restaurantId } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      themeColor: true,
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
      ...(supportsMenuFontSize ? { menuFontSizePx: true } : {}),
      ...(supportsMenuTextColor ? { menuTextColor: true } : {}),
      ...(supportsMenuBackgroundColor ? { menuBackgroundColor: true } : {}),
      ...(supportsMenuButtonBackgroundColor ? { menuButtonBackgroundColor: true } : {}),
      ...(supportsMenuHeaderBackgroundColor ? { menuHeaderBackgroundColor: true } : {}),
    },
  });

  if (!restaurant) {
    return null;
  }

  const weeklyHours = supportsRestaurantWorkingHours
    ? ((restaurant as { workingHours?: unknown[] }).workingHours ?? [])
    : [];
  const orderingAvailability = evaluateRestaurantOrderingAvailability({
    orderingDisabled: restaurant.orderingDisabled,
    weeklyHours: weeklyHours as {
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
    }[],
    openingHour: restaurant.openingHour,
    closingHour: restaurant.closingHour,
  });

  const activeMenu = await prisma.menu.findFirst({
    where: {
      tenantId: params.tenantId,
      isActive: true,
      OR: [{ restaurantId: restaurant.id }, { restaurantId: null }],
    },
    orderBy: [{ restaurantId: "desc" }, { id: "asc" }],
    select: { id: true },
  });

  if (!activeMenu) {
    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logoUrl: restaurant.logoUrl,
        themeColor: restaurant.themeColor ?? "primary",
        menuFontSizePx: supportsMenuFontSize
          ? (restaurant as { menuFontSizePx?: number | null }).menuFontSizePx ?? null
          : null,
        menuTextColor: supportsMenuTextColor
          ? (restaurant as { menuTextColor?: string | null }).menuTextColor ?? null
          : null,
        menuBackgroundColor: supportsMenuBackgroundColor
          ? (restaurant as { menuBackgroundColor?: string | null }).menuBackgroundColor ?? null
          : null,
        menuButtonBackgroundColor: supportsMenuButtonBackgroundColor
          ? (restaurant as { menuButtonBackgroundColor?: string | null })
              .menuButtonBackgroundColor ?? null
          : null,
        menuHeaderBackgroundColor: supportsMenuHeaderBackgroundColor
          ? (restaurant as { menuHeaderBackgroundColor?: string | null })
              .menuHeaderBackgroundColor ?? null
          : null,
        openingHour: orderingAvailability.todayOpeningHour,
        closingHour: orderingAvailability.todayClosingHour,
        orderingClosed: !orderingAvailability.isOpen,
        menuComplianceVisible,
        orderingFeatureEnabled: storefrontAccess.orderingEnabled,
      },
      categories: [],
      hasPublishedMenu: false,
    };
  }

  const menuRestaurant = await prisma.restaurant.findFirst({
    where: { id: restaurant.id, tenantId: params.tenantId },
    include: {
      categories: {
        where: { menuId: activeMenu.id },
        orderBy: { id: "asc" },
        include: {
          products: {
            where: getProductMenuVisibilityWhere(new Date()),
            orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
            include: {
              complianceInfo: true,
            },
          },
        },
      },
    },
  });

  if (!menuRestaurant) {
    return null;
  }

  const categories = menuRestaurant.categories
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
        stockQuantity: Number((product as { stockQuantity?: number | null }).stockQuantity ?? 0),
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

  return {
    restaurant: {
      id: menuRestaurant.id,
      name: menuRestaurant.name,
      logoUrl: menuRestaurant.logoUrl,
      themeColor: menuRestaurant.themeColor ?? "primary",
      menuFontSizePx: menuRestaurant.menuFontSizePx ?? null,
      menuTextColor: menuRestaurant.menuTextColor ?? null,
      menuBackgroundColor: menuRestaurant.menuBackgroundColor ?? null,
      menuButtonBackgroundColor: menuRestaurant.menuButtonBackgroundColor ?? null,
      menuHeaderBackgroundColor: menuRestaurant.menuHeaderBackgroundColor ?? null,
      openingHour: orderingAvailability.todayOpeningHour,
      closingHour: orderingAvailability.todayClosingHour,
      orderingClosed: !orderingAvailability.isOpen,
      menuComplianceVisible,
      orderingFeatureEnabled: storefrontAccess.orderingEnabled,
    },
    categories,
    hasPublishedMenu: true,
  };
}
