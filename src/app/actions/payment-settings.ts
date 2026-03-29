"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { logServerError } from "@/lib/server-error-log";

export async function savePaymentMethods(data: {
  cashActive: boolean;
  creditCardActive: boolean;
}) {
  try {
    const { tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenantPaymentMethod.upsert({
        where: {
          tenantId_method: {
            tenantId,
            method: "CASH",
          },
        },
        update: { isActive: data.cashActive },
        create: {
          tenantId,
          method: "CASH",
          isActive: data.cashActive,
        },
      });

      await tx.tenantPaymentMethod.upsert({
        where: {
          tenantId_method: {
            tenantId,
            method: "CREDIT_CARD",
          },
        },
        update: { isActive: data.creditCardActive },
        create: {
          tenantId,
          method: "CREDIT_CARD",
          isActive: data.creditCardActive,
        },
      });
    });

    revalidatePath("/restaurant/settings");
    return { success: true, message: "Odeme yontemleri guncellendi." };
  } catch (error) {
    logServerError("payment-settings", error);
    return { success: false, message: "Odeme yontemleri kaydedilemedi." };
  }
}
