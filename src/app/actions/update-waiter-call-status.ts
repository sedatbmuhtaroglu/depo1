'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";

type WaiterCallStatusValue = "PENDING" | "ACKNOWLEDGED" | "RESOLVED";

export async function updateWaiterCallStatus(
  waiterCallId: number,
  status: WaiterCallStatusValue,
) {
  try {
    const { username, tenantId, staffId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const now = new Date();
    const existing = await prisma.waiterCall.findFirst({
      where: { id: waiterCallId, tenantId },
    });
    if (!existing) {
      return { success: false, message: "Çağrı bulunamadı." };
    }

    const data: { status: WaiterCallStatusValue; resolvedAt?: Date; acknowledgedAt?: Date; acknowledgedByStaffId?: number | null } = {
      status,
      resolvedAt: status === "RESOLVED" ? now : undefined,
    };
    if (status === "ACKNOWLEDGED" && !existing.acknowledgedAt) {
      data.acknowledgedAt = now;
      data.acknowledgedByStaffId = staffId ?? null;
    }
    if (status === "RESOLVED" && !existing.acknowledgedAt) {
      data.acknowledgedAt = now;
      data.acknowledgedByStaffId = staffId ?? null;
    }

    await prisma.waiterCall.update({
      where: { id: waiterCallId },
      data,
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "WAITER_CALL_STATUS",
      entityType: "WaiterCall",
      entityId: String(waiterCallId),
      description: status,
    });

    revalidatePath("/waiter");
    return { success: true };
  } catch (error) {
    logServerError("update-waiter-call-status", error);
    return { success: false, message: "Garson çağrısı güncellenemedi." };
  }
}

