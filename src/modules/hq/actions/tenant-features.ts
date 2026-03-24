"use server";

import { FeatureCode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";

type ActionResult = { success: true; message: string } | { success: false; message: string };
type FeatureOverrideState = "ENABLED" | "DISABLED" | "DEFAULT";

const FEATURE_DISPLAY_MAP: Record<FeatureCode, { name: string; description: string }> = {
  MENU: { name: "Menu", description: "Digital menu" },
  WAITER_CALL: { name: "Waiter Call", description: "Customer waiter call" },
  ORDERING: { name: "Ordering", description: "QR ordering" },
  CUSTOM_DOMAIN: { name: "Custom Domain", description: "Custom domain support" },
  INVOICING: { name: "Invoicing", description: "Billing and invoicing" },
  ADVANCED_REPORTS: {
    name: "Advanced Reports",
    description: "Extended reports",
  },
  KITCHEN_DISPLAY: {
    name: "Kitchen Display",
    description: "Kitchen panel",
  },
  ANALYTICS: { name: "Analytics", description: "Analytics module" },
};

function parseFeatureCode(value: string | null): FeatureCode | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(FEATURE_DISPLAY_MAP, raw)) {
    return raw as FeatureCode;
  }
  return null;
}

function parseFeatureState(value: string | null): FeatureOverrideState | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "ENABLED" || raw === "DISABLED" || raw === "DEFAULT") {
    return raw;
  }
  return null;
}

async function ensureFeatureRow(featureCode: FeatureCode) {
  const display = FEATURE_DISPLAY_MAP[featureCode];
  return prisma.feature.upsert({
    where: { code: featureCode },
    update: {
      name: display.name,
      description: display.description,
    },
    create: {
      code: featureCode,
      name: display.name,
      description: display.description,
    },
    select: { id: true },
  });
}

export async function updateTenantFeatureOverrideAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const tenantId = Number(formData.get("tenantId"));
    const featureCode = parseFeatureCode(formData.get("featureCode")?.toString() ?? null);
    const state = parseFeatureState(formData.get("state")?.toString() ?? null);

    if (!Number.isInteger(tenantId) || tenantId <= 0 || !featureCode || !state) {
      return { success: false, message: "Gecersiz feature degisikligi." };
    }

    const hq = await assertHqMutationGuard({
      capability: "TENANT_FEATURE_MANAGE",
      tenantId,
    });

    const feature = await ensureFeatureRow(featureCode);

    if (state === "DEFAULT") {
      await prisma.tenantFeature.deleteMany({
        where: {
          tenantId,
          featureId: feature.id,
        },
      });
    } else {
      await prisma.tenantFeature.upsert({
        where: {
          tenantId_featureId: {
            tenantId,
            featureId: feature.id,
          },
        },
        update: {
          enabled: state === "ENABLED",
        },
        create: {
          tenantId,
          featureId: feature.id,
          enabled: state === "ENABLED",
        },
      });
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: `hq:${hq.username}` },
      actionType: "HQ_TENANT_FEATURE_OVERRIDE",
      entityType: "TenantFeature",
      entityId: featureCode,
      description: `feature=${featureCode}; state=${state}`,
    });

    revalidatePath("/hq");
    revalidatePath("/hq/tenants");
    revalidatePath(`/hq/tenants/${tenantId}`);

    return { success: true, message: "Feature override guncellendi." };
  } catch {
    return { success: false, message: "Feature override guncellenemedi." };
  }
}
