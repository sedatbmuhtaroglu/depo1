"use server";

import { PlanCode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";

type ActionResult = { success: true; message: string } | { success: false; message: string };

function parsePlanCode(value: string): PlanCode | null {
  const raw = value.trim().toUpperCase();
  if (raw === "MINI" || raw === "RESTAURANT" || raw === "CORPORATE") {
    return raw;
  }
  return null;
}

export async function updateTenantPlanAction(formData: FormData): Promise<ActionResult> {
  try {
    const tenantId = Number(formData.get("tenantId"));
    const planCode = parsePlanCode(formData.get("planCode")?.toString() ?? "");

    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return { success: false, message: "Gecersiz tenant." };
    }

    const hq = await assertHqMutationGuard({
      capability: "TENANT_PLAN_MANAGE",
      tenantId,
    });

    if (!planCode) {
      return { success: false, message: "Gecersiz plan secimi." };
    }

    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
      select: { id: true, code: true, isActive: true },
    });
    if (!plan || !plan.isActive) {
      return { success: false, message: "Plan bulunamadi veya pasif." };
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { planId: plan.id },
      select: { id: true },
    });

    await writeAuditLog({
      tenantId: updated.id,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TENANT_PLAN_UPDATE",
      entityType: "Tenant",
      entityId: String(updated.id),
      description: `plan=${plan.code}`,
    });

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${updated.id}`);

    return { success: true, message: "Tenant plani guncellendi." };
  } catch {
    return { success: false, message: "Plan guncellenemedi." };
  }
}
