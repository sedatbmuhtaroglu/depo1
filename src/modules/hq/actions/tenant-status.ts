"use server";

import { revalidatePath } from "next/cache";
import { getTenantLifecycleSnapshot } from "@/core/tenancy/lifecycle-policy";
import { writeAuditLog } from "@/lib/audit-log";
import { decimalLikeToCents } from "@/lib/commercial-record";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import {
  isTenantLifecycleTransitionAllowed,
  resolveLifecycleTransitionPatch,
  type LifecycleTransitionTarget,
} from "@/modules/hq/server/tenant-status";

type ActionResult = { success: true; message: string } | { success: false; message: string };
const COMMERCIAL_REQUIRED_MESSAGE =
  "Tenant ACTIVE edilmeden once ticari kayit olusturulmalidir.";

function parseTargetLifecycle(value: string | null): LifecycleTransitionTarget | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (
    raw === "TRIAL" ||
    raw === "ACTIVE" ||
    raw === "PENDING_SETUP" ||
    raw === "SUSPENDED" ||
    raw === "PAST_DUE"
  ) {
    return raw;
  }
  return null;
}

export async function updateTenantStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantIdRaw = Number(formData.get("tenantId"));
    const targetLifecycle = parseTargetLifecycle(
      formData.get("targetLifecycleStatus")?.toString() ?? null,
    );

    if (!Number.isInteger(tenantIdRaw) || tenantIdRaw <= 0 || !targetLifecycle) {
      return { success: false, message: "Gecersiz tenant veya status secimi." };
    }

    const hq = await assertHqMutationGuard({
      capability: "TENANT_STATUS_MANAGE",
      tenantId: tenantIdRaw,
    });

    const lifecycle = await getTenantLifecycleSnapshot(tenantIdRaw);
    const allowed = isTenantLifecycleTransitionAllowed({
      currentLifecycleStatus: lifecycle.normalizedStatus,
      targetLifecycleStatus: targetLifecycle,
    });

    if (!allowed) {
      return {
        success: false,
        message: "Bu status gecisi lifecycle kurallarina gore izinli degil.",
      };
    }

    if (targetLifecycle === "ACTIVE" && lifecycle.normalizedStatus !== "TRIAL") {
      const commercialRecord = await prisma.commercialRecord.findFirst({
        where: {
          operationalStatus: { not: "CANCELLED" },
          OR: [{ tenantId: tenantIdRaw }, { lead: { tenantId: tenantIdRaw } }],
        },
        select: {
          id: true,
          netSaleAmount: true,
        },
      });

      if (!commercialRecord || decimalLikeToCents(commercialRecord.netSaleAmount) <= 0) {
        return { success: false, message: COMMERCIAL_REQUIRED_MESSAGE };
      }
    }

    const transitionPatch = resolveLifecycleTransitionPatch(targetLifecycle);

    const updated = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantIdRaw },
        data: {
          status: transitionPatch.status,
          setupCompleted: transitionPatch.setupCompleted,
        },
        select: { id: true, name: true, status: true },
      });

      await tx.setupProgress.upsert({
        where: { tenantId: tenantIdRaw },
        update: {
          currentStep: transitionPatch.setupStep,
          completedAt: transitionPatch.setupCompleted ? new Date() : null,
        },
        create: {
          tenantId: tenantIdRaw,
          currentStep: transitionPatch.setupStep,
          completedAt: transitionPatch.setupCompleted ? new Date() : null,
        },
      });

      return tenant;
    });

    await writeAuditLog({
      tenantId: updated.id,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TENANT_STATUS_UPDATE",
      entityType: "Tenant",
      entityId: String(updated.id),
      description: `targetLifecycle=${targetLifecycle}; persisted=${String(updated.status)}`,
    });

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${updated.id}`);

    return { success: true, message: "Tenant status guncellendi." };
  } catch {
    return { success: false, message: "Tenant status guncellenemedi." };
  }
}
