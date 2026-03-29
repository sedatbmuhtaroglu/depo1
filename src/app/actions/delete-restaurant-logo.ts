"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { deleteRestaurantLogoFileIfLocal } from "@/lib/restaurant-logo-storage";
import { logServerError } from "@/lib/server-error-log";

export async function deleteRestaurantLogo(restaurantId: number) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
      select: { id: true, logoUrl: true },
    });
    if (!restaurant) {
      return { success: false, message: "Restoran bulunamadi." };
    }

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { logoUrl: null },
    });

    await deleteRestaurantLogoFileIfLocal(restaurant.logoUrl);

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "RESTAURANT_SETTINGS",
      entityType: "Restaurant",
      entityId: String(restaurantId),
      description: "Logo kaldirildi",
    });

    revalidatePath("/restaurant/settings");
    revalidatePath("/restaurant");
    return { success: true };
  } catch (error) {
    logServerError("delete-restaurant-logo", error);
    return { success: false, message: "Logo silinemedi." };
  }
}
