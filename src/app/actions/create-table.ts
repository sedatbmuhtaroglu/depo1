"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { generatePublicCode } from "@/lib/table-session";
import { writeAuditLog } from "@/lib/audit-log";
import { assertTenantLimit, isTenantLimitExceededError } from "@/lib/tenant-limits";
import { logServerError } from "@/lib/server-error-log";

export async function createTable(restaurantId: number, tableNo: number) {
  try {
    const { username, tenantId } = await requireManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const restaurant = await prisma.restaurant.findFirst({
      where: { id: restaurantId, tenantId },
      select: { id: true },
    });
    if (!restaurant) {
      return { success: false, message: "Restoran bulunamadı." };
    }

    const existing = await prisma.table.findFirst({
      where: { restaurantId, tableNo },
      select: { id: true },
    });
    if (existing) {
      return { success: false, message: "Bu masa numarası zaten kullanılıyor." };
    }

    const table = await prisma.$transaction(
      async (tx) => {
        await assertTenantLimit(tenantId, "TABLES", tx);

        const publicCode = generatePublicCode(8);
        return tx.table.create({
          data: {
            restaurantId,
            tableNo,
            qrCode: publicCode,
            publicCode,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "TABLE_CREATE",
      entityType: "Table",
      entityId: String(table.id),
      description: `Masa eklendi: ${tableNo}`,
    });

    revalidatePath("/restaurant");
    revalidatePath("/restaurant/tables");
    revalidatePath("/waiter");
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
        message: "İşlem yoğunluğu nedeniyle masa eklenemedi. Lütfen tekrar deneyin.",
      };
    }

    logServerError("create-table", error);
    return { success: false, message: "Masa eklenemedi." };
  }
}
