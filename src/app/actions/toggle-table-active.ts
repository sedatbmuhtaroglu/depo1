'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";
import { getTableBillingSnapshot } from "@/lib/table-billing";
import { logServerError } from "@/lib/server-error-log";

export async function toggleTableActive(tableId: number, isActive: boolean) {
  try {
    const { username, tenantId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        restaurant: {
          tenantId,
        },
      },
    });

    if (!table) {
      return {
        success: false,
        message: "Bu masaya erisim yetkiniz yok veya masa bulunamadi.",
      };
    }

    let closingBillingSnapshot: Awaited<ReturnType<typeof getTableBillingSnapshot>> | null =
      null;

    if (!isActive) {
      const activeOrdersCount = await prisma.order.count({
        where: {
          tableId: table.id,
          status: {
            in: ["PENDING_WAITER_APPROVAL", "PENDING", "PREPARING"],
          },
          AND: [STAFF_VISIBLE_ORDER_FILTER],
        },
      });
      if (activeOrdersCount > 0) {
        return {
          success: false,
          message:
            "Bu masadaki aktif siparişleri iptal etmeden masa kapatilamaz.",
        };
      }

      closingBillingSnapshot = await getTableBillingSnapshot({
        tenantId,
        tableId: table.id,
      });

      if (closingBillingSnapshot.totalUnpaid > 0) {
        return {
          success: false,
          message:
            "Bu masada odenmemis hesap var. Once odeme tamamlanmadan masa kapatilamaz.",
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.table.update({
        where: { id: table.id },
        data: { isActive },
      });

      if (!isActive) {
        const now = new Date();

        const activeSession = await tx.tableSession.findFirst({
          where: {
            tenantId,
            tableId: table.id,
            isActive: true,
          },
          select: { id: true },
        });

        await tx.tableSession.updateMany({
          where: {
            tenantId,
            tableId: table.id,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        await tx.billRequest.updateMany({
          where: {
            tenantId,
            tableId: table.id,
            status: {
              in: ["PENDING", "ACKNOWLEDGED"],
            },
          },
          data: {
            status: "CANCELED",
          },
        });

        const shouldCreateSettlementMarker =
          Boolean(closingBillingSnapshot) &&
          ((closingBillingSnapshot?.completedOrderCount ?? 0) > 0 ||
            (closingBillingSnapshot?.totalPaid ?? 0) > 0 ||
            (closingBillingSnapshot?.totalFromOrders ?? 0) > 0);

        if (shouldCreateSettlementMarker) {
          await tx.billRequest.create({
            data: {
              tenantId,
              tableId: table.id,
              tableSessionId: activeSession?.id ?? null,
              status: "SETTLED",
              settledAt: now,
            },
          });
        }
      }
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: isActive ? "TABLE_OPEN" : "TABLE_CLOSE",
      entityType: "Table",
      entityId: String(tableId),
      description: isActive ? "Masa acildi" : "Masa kapatildi",
    });

    revalidatePath("/restaurant");
    revalidatePath("/waiter");

    return { success: true };
  } catch (error) {
    logServerError("toggle-table-active", error);
    return { success: false, message: "Masa durumu guncellenemedi." };
  }
}

