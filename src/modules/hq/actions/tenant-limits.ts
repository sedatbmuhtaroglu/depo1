"use server";

import { LimitResource } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";

type ActionResult = { success: true; message: string } | { success: false; message: string };
type LimitOverrideMode = "DEFAULT" | "VALUE" | "UNLIMITED";

function parseResource(value: string | null): LimitResource | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (
    raw === "USERS" ||
    raw === "TABLES" ||
    raw === "MENUS" ||
    raw === "PRODUCTS" ||
    raw === "BRANCHES" ||
    raw === "DEVICES"
  ) {
    return raw;
  }
  return null;
}

function parseMode(value: string | null): LimitOverrideMode | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "DEFAULT" || raw === "VALUE" || raw === "UNLIMITED") {
    return raw;
  }
  return null;
}

export async function updateTenantLimitOverrideAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const tenantId = Number(formData.get("tenantId"));
    const resource = parseResource(formData.get("resource")?.toString() ?? null);
    const mode = parseMode(formData.get("mode")?.toString() ?? null);
    const valueRaw = formData.get("limitValue")?.toString().trim() ?? "";

    if (!Number.isInteger(tenantId) || tenantId <= 0 || !resource || !mode) {
      return { success: false, message: "Gecersiz limit override istegi." };
    }

    const hq = await assertHqMutationGuard({
      capability: "TENANT_LIMIT_MANAGE",
      tenantId,
    });

    if (mode === "DEFAULT") {
      await prisma.tenantLimitOverride.deleteMany({
        where: { tenantId, resource },
      });
      await writeAuditLog({
        tenantId,
        actor: { type: "admin", id: `hq:${hq.username}` },
        actionType: "HQ_TENANT_LIMIT_OVERRIDE",
        entityType: "TenantLimitOverride",
        entityId: resource,
        description: `resource=${resource}; mode=DEFAULT`,
      });
    } else if (mode === "UNLIMITED") {
      await prisma.tenantLimitOverride.upsert({
        where: {
          tenantId_resource: {
            tenantId,
            resource,
          },
        },
        update: { limit: null },
        create: { tenantId, resource, limit: null },
      });
      await writeAuditLog({
        tenantId,
        actor: { type: "admin", id: `hq:${hq.username}` },
        actionType: "HQ_TENANT_LIMIT_OVERRIDE",
        entityType: "TenantLimitOverride",
        entityId: resource,
        description: `resource=${resource}; mode=UNLIMITED`,
      });
    } else {
      const parsed = Number.parseInt(valueRaw, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return { success: false, message: "Limit degeri 0 veya daha buyuk olmali." };
      }
      await prisma.tenantLimitOverride.upsert({
        where: {
          tenantId_resource: {
            tenantId,
            resource,
          },
        },
        update: { limit: parsed },
        create: { tenantId, resource, limit: parsed },
      });
      await writeAuditLog({
        tenantId,
        actor: { type: "admin", id: `hq:${hq.username}` },
        actionType: "HQ_TENANT_LIMIT_OVERRIDE",
        entityType: "TenantLimitOverride",
        entityId: resource,
        description: `resource=${resource}; mode=VALUE; value=${parsed}`,
      });
    }

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${tenantId}`);

    return { success: true, message: "Limit override guncellendi." };
  } catch {
    return { success: false, message: "Limit override guncellenemedi." };
  }
}
