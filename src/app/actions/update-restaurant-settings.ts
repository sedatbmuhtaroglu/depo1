"use server";

import { createStaffActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import {
  MAX_ORDER_RADIUS_METERS,
  MIN_ORDER_RADIUS_METERS,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/location";
import {
  type WeeklyWorkingHourInput,
  normalizeWeeklyWorkingHours,
  validateWeeklyWorkingHoursInput,
} from "@/lib/restaurant-working-hours";
import { validateMenuThemeInput } from "@/lib/menu-theme";
import { deleteRestaurantLogoFileIfLocal } from "@/lib/restaurant-logo-storage";
import { logServerError } from "@/lib/server-error-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export async function updateRestaurantSettings(data: {
  restaurantId: number;
  name?: string;
  logoUrl?: string | null;
  openingHour?: string | null;
  closingHour?: string | null;
  workingHours?: WeeklyWorkingHourInput[];
  orderingDisabled?: boolean;
  locationEnforcementEnabled?: boolean;
  orderRadiusMeters?: number;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  kitchenWarningYellowMin?: number | null;
  kitchenWarningOrangeMin?: number | null;
  kitchenWarningRedMin?: number | null;
  themeColor?: "primary" | "secondary";
  menuFontSizePx?: number | null;
  menuTextColor?: string | null;
  menuBackgroundColor?: string | null;
  menuButtonBackgroundColor?: string | null;
  menuHeaderBackgroundColor?: string | null;
}) {
  try {
    await assertPrivilegedServerActionOrigin();
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }
    await assertSurfaceGuard({
      surface: "ops-private",
      actor: createStaffActor({
        tenantId,
        username,
        role: "MANAGER",
      }),
      tenantId,
      operation: "mutation",
      requiredCapability: "RESTAURANT_SETTINGS_MANAGE",
    });

    const restaurant = await prisma.restaurant.findFirst({
      where: { id: data.restaurantId, tenantId },
      select: {
        id: true,
        logoUrl: true,
        locationEnforcementEnabled: true,
        locationLatitude: true,
        locationLongitude: true,
      },
    });

    if (!restaurant) {
      return { success: false, message: "Restoran bulunamadi." };
    }

    if (
      data.locationLatitude !== undefined &&
      data.locationLatitude !== null &&
      !isValidLatitude(data.locationLatitude)
    ) {
      return { success: false, message: "Enlem -90 ile 90 arasinda olmalidir." };
    }

    if (
      data.locationLongitude !== undefined &&
      data.locationLongitude !== null &&
      !isValidLongitude(data.locationLongitude)
    ) {
      return { success: false, message: "Boylam -180 ile 180 arasinda olmalidir." };
    }

    if (
      data.orderRadiusMeters !== undefined &&
      (!Number.isFinite(data.orderRadiusMeters) ||
        data.orderRadiusMeters < MIN_ORDER_RADIUS_METERS ||
        data.orderRadiusMeters > MAX_ORDER_RADIUS_METERS)
    ) {
      return {
        success: false,
        message: `Maksimum mesafe ${MIN_ORDER_RADIUS_METERS}-${MAX_ORDER_RADIUS_METERS} metre araliginda olmalidir.`,
      };
    }

    const enforcementEnabled =
      data.locationEnforcementEnabled ?? restaurant.locationEnforcementEnabled;
    const effectiveLatitude =
      data.locationLatitude !== undefined
        ? data.locationLatitude
        : restaurant.locationLatitude != null
          ? Number(restaurant.locationLatitude)
          : null;
    const effectiveLongitude =
      data.locationLongitude !== undefined
        ? data.locationLongitude
        : restaurant.locationLongitude != null
          ? Number(restaurant.locationLongitude)
          : null;

    if (enforcementEnabled) {
      if (effectiveLatitude == null || effectiveLongitude == null) {
        return {
          success: false,
          message:
            "Konum dogrulamasi aktifken restoran koordinatlari zorunludur.",
        };
      }
      if (
        !isValidLatitude(effectiveLatitude) ||
        !isValidLongitude(effectiveLongitude)
      ) {
        return {
          success: false,
          message:
            "Konum dogrulamasi aktifken restoran koordinatlari gecerli olmali.",
        };
      }
    }

    const normalizedWorkingHours =
      data.workingHours !== undefined
        ? normalizeWeeklyWorkingHours(data.workingHours)
        : null;
    if (normalizedWorkingHours) {
      const validation = validateWeeklyWorkingHoursInput(normalizedWorkingHours);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message ?? "Calisma saatleri gecersiz.",
        };
      }
    }
    const menuThemeValidation = validateMenuThemeInput({
      menuFontSizePx: data.menuFontSizePx,
      menuTextColor: data.menuTextColor,
      menuBackgroundColor: data.menuBackgroundColor,
      menuButtonBackgroundColor: data.menuButtonBackgroundColor,
      menuHeaderBackgroundColor: data.menuHeaderBackgroundColor,
    });
    if (!menuThemeValidation.valid) {
      return {
        success: false,
        message: menuThemeValidation.message,
      };
    }
    const normalizedLogoUrl =
      data.logoUrl !== undefined ? data.logoUrl?.trim() || null : undefined;

    if (data.name && data.name.length > 100) {
      return { success: false, message: "Restoran adı çok uzun (maks 100)." };
    }

    await prisma.$transaction(async (tx) => {
      const firstOpenDay = normalizedWorkingHours?.find(
        (row) => row.isOpen && row.openTime && row.closeTime,
      );

      await tx.restaurant.update({
        where: { id: data.restaurantId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(normalizedLogoUrl !== undefined && { logoUrl: normalizedLogoUrl }),
          ...(normalizedWorkingHours
            ? {
                openingHour: firstOpenDay?.openTime ?? null,
                closingHour: firstOpenDay?.closeTime ?? null,
              }
            : {
                ...(data.openingHour !== undefined && { openingHour: data.openingHour }),
                ...(data.closingHour !== undefined && { closingHour: data.closingHour }),
              }),
          ...(data.orderingDisabled !== undefined && {
            orderingDisabled: data.orderingDisabled,
          }),
          ...(data.locationEnforcementEnabled !== undefined && {
            locationEnforcementEnabled: data.locationEnforcementEnabled,
          }),
          ...(data.orderRadiusMeters !== undefined && {
            orderRadiusMeters: data.orderRadiusMeters,
          }),
          ...(data.locationLatitude !== undefined && {
            locationLatitude: data.locationLatitude,
          }),
          ...(data.locationLongitude !== undefined && {
            locationLongitude: data.locationLongitude,
          }),
          ...(data.kitchenWarningYellowMin !== undefined && {
            kitchenWarningYellowMin: data.kitchenWarningYellowMin,
          }),
          ...(data.kitchenWarningOrangeMin !== undefined && {
            kitchenWarningOrangeMin: data.kitchenWarningOrangeMin,
          }),
          ...(data.kitchenWarningRedMin !== undefined && {
            kitchenWarningRedMin: data.kitchenWarningRedMin,
          }),
          ...(data.themeColor !== undefined && { themeColor: data.themeColor }),
          ...(data.menuFontSizePx !== undefined && {
            menuFontSizePx: data.menuFontSizePx,
          }),
          ...(data.menuTextColor !== undefined && {
            menuTextColor: data.menuTextColor?.trim().toUpperCase() ?? null,
          }),
          ...(data.menuBackgroundColor !== undefined && {
            menuBackgroundColor: data.menuBackgroundColor?.trim().toUpperCase() ?? null,
          }),
          ...(data.menuButtonBackgroundColor !== undefined && {
            menuButtonBackgroundColor:
              data.menuButtonBackgroundColor?.trim().toUpperCase() ?? null,
          }),
          ...(data.menuHeaderBackgroundColor !== undefined && {
            menuHeaderBackgroundColor:
              data.menuHeaderBackgroundColor?.trim().toUpperCase() ?? null,
          }),
        },
      });

      if (normalizedWorkingHours) {
        for (const row of normalizedWorkingHours) {
          await tx.restaurantWorkingHour.upsert({
            where: {
              restaurantId_weekday: {
                restaurantId: data.restaurantId,
                weekday: row.weekday,
              },
            },
            update: {
              isOpen: row.isOpen,
              openTime: row.isOpen ? row.openTime : null,
              closeTime: row.isOpen ? row.closeTime : null,
            },
            create: {
              restaurantId: data.restaurantId,
              weekday: row.weekday,
              isOpen: row.isOpen,
              openTime: row.isOpen ? row.openTime : null,
              closeTime: row.isOpen ? row.closeTime : null,
            },
          });
        }
      }
    });

    if (
      normalizedLogoUrl !== undefined &&
      restaurant.logoUrl &&
      restaurant.logoUrl !== normalizedLogoUrl
    ) {
      await deleteRestaurantLogoFileIfLocal(restaurant.logoUrl);
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "RESTAURANT_SETTINGS",
      entityType: "Restaurant",
      entityId: String(data.restaurantId),
      description: "Ayarlar guncellendi",
    });

    revalidatePath("/restaurant/settings");
    revalidatePath("/restaurant");
    return { success: true };
  } catch (e) {
    logServerError("update-restaurant-settings", e);
    return { success: false, message: "Ayarlar kaydedilemedi." };
  }
}
