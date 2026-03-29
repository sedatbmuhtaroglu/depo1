"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  assertTenantReadyForGoLive,
  TenantGoLiveReadinessError,
} from "@/core/tenancy/setup-progress";
import { requireManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-error-log";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { assertTenantLimit, isTenantLimitExceededError } from "@/lib/tenant-limits";

export async function createMenu(data: {
  name: string;
  restaurantId?: number | null;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };

    const name = data.name.trim();
    if (!name) return { success: false, message: "Menu adi giriniz." };

    if (data.restaurantId) {
      const restaurant = await prisma.restaurant.findFirst({
        where: { id: data.restaurantId, tenantId },
        select: { id: true },
      });
      if (!restaurant) return { success: false, message: "Restoran bulunamadi." };
    }

    await prisma.$transaction(
      async (tx) => {
        await assertTenantLimit(tenantId, "MENUS", tx);

        await tx.menu.create({
          data: {
            tenantId,
            restaurantId: data.restaurantId ?? null,
            name,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (error) {
    if (isTenantLimitExceededError(error)) {
      return {
        success: false,
        message: error.message,
        limit: {
          resource: error.resource,
          used: error.used,
          max: error.max,
        },
      };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return {
        success: false,
        message: "Islem yogunlugu nedeniyle menu olusturulamadi. Lutfen tekrar deneyin.",
      };
    }

    logServerError("menu-management", error);
    return { success: false, message: "Menu olusturulamadi." };
  }
}

export async function activateMenu(menuId: number) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) return { success: false, message: "Yetkisiz." };

    const menu = await prisma.menu.findFirst({
      where: { id: menuId, tenantId },
      select: { id: true },
    });
    if (!menu) return { success: false, message: "Menu bulunamadi." };

    await assertTenantReadyForGoLive(tenantId);

    await prisma.$transaction(async (tx) => {
      await tx.menu.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      });
      await tx.menu.update({
        where: { id: menuId },
        data: { isActive: true },
      });
    });

    revalidatePath("/restaurant/menu");
    return { success: true };
  } catch (error) {
    if (error instanceof TenantGoLiveReadinessError) {
      const details = error.blockers.slice(0, 3).join(" ");
      return {
        success: false,
        message: details
          ? `Menu canliya alinamadi. ${details}`
          : "Menu canliya alinmadan once kurulum adimlarini tamamlayin.",
      };
    }

    logServerError("menu-management", error);
    return { success: false, message: "Menu aktiflestirilemedi." };
  }
}
