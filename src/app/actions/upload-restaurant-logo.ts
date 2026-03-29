"use server";

import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { prisma } from "@/lib/prisma";
import { saveRestaurantLogoFile } from "@/lib/restaurant-logo-storage";
import { logServerError } from "@/lib/server-error-log";

export async function uploadRestaurantLogo(formData: FormData) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const restaurantIdRaw = formData.get("restaurantId");
    const restaurantId = Number(restaurantIdRaw);
    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return { success: false, message: "Gecersiz restoran." };
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
      select: { id: true },
    });
    if (!restaurant) {
      return { success: false, message: "Restoran bulunamadi." };
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, message: "Dosya bulunamadi." };
    }

    const result = await saveRestaurantLogoFile({ tenantId, file });
    if (!result.success) {
      return result;
    }

    return { success: true, url: result.url };
  } catch (error) {
    logServerError("upload-restaurant-logo", error);
    return { success: false, message: "Logo yuklenemedi." };
  }
}
