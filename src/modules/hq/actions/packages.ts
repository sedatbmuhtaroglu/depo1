"use server";

import { FeatureCode, LimitResource, PlanCode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  ENTITLEMENT_LIMIT_RESOURCES,
  getPlanEntitlementDefaults,
  getPlanEntitlementLimits,
  isEntitlementFeatureCode,
  type EntitlementFeature,
  type EntitlementLimitResource,
} from "@/core/entitlements/engine";
import { getFeaturePresentation } from "@/modules/hq/server/tenant-package-feature-labels";
import { prisma } from "@/lib/prisma";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";

type ActionResult = { success: true; message: string } | { success: false; message: string };

function parsePlanCode(value: string | null): PlanCode | null {
  const raw = (value ?? "").trim().toUpperCase();
  if (raw === "MINI" || raw === "RESTAURANT" || raw === "CORPORATE") {
    return raw;
  }
  return null;
}

function parsePositiveInt(value: string | null): number | null {
  const raw = (value ?? "").trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseToggle(value: string | null): boolean {
  const raw = (value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

function parseLimitValue(input: { mode: string | null; value: string | null }): number | null | "INVALID" {
  const mode = (input.mode ?? "").trim().toUpperCase();
  if (mode === "UNLIMITED") return null;
  if (mode === "VALUE") {
    const parsed = Number.parseInt((input.value ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return "INVALID";
    return parsed;
  }
  return "INVALID";
}

function parseFeatureCodes(values: FormDataEntryValue[]): EntitlementFeature[] {
  const unique = new Set<EntitlementFeature>();
  for (const entry of values) {
    const code = String(entry);
    if (!isEntitlementFeatureCode(code)) continue;
    unique.add(code);
  }
  return Array.from(unique);
}

function mapFeatureCodeToDisplay(code: EntitlementFeature) {
  const presentation = getFeaturePresentation({ code });
  return {
    name: presentation.label,
    description: presentation.group,
  };
}

function toFeatureCode(code: EntitlementFeature): FeatureCode {
  return code as FeatureCode;
}

function toLimitResource(resource: EntitlementLimitResource): LimitResource {
  return resource as LimitResource;
}

async function ensureFeatureRows(codes: readonly EntitlementFeature[]) {
  const rows: Array<{ code: FeatureCode; id: number }> = [];
  for (const code of codes) {
    const display = mapFeatureCodeToDisplay(code);
    const row = await prisma.feature.upsert({
      where: { code: toFeatureCode(code) },
      update: {
        name: display.name,
      },
      create: {
        code: toFeatureCode(code),
        name: display.name,
        description: display.description,
      },
      select: { id: true, code: true },
    });
    rows.push({ code: row.code, id: row.id });
  }
  return rows;
}

async function writePlanAuditForLinkedTenants(input: {
  actorId: string;
  planId: number;
  actionType: string;
  description: string;
}) {
  const tenants = await prisma.tenant.findMany({
    where: { planId: input.planId },
    select: { id: true },
  });
  if (tenants.length === 0) return;
  await prisma.auditLog.createMany({
    data: tenants.map((tenant) => ({
      tenantId: tenant.id,
      actorType: "admin",
      actorId: input.actorId,
      role: null,
      actionType: input.actionType,
      entityType: "Plan",
      entityId: String(input.planId),
      description: input.description,
    })),
  });
}

export async function createPackageAction(formData: FormData): Promise<ActionResult> {
  try {
    const hq = await assertHqMutationGuard({
      capability: "TENANT_PLAN_MANAGE",
    });

    const displayName = (formData.get("displayName")?.toString() ?? "").trim();
    const code = parsePlanCode(formData.get("code")?.toString() ?? null);
    const isActive = parseToggle(formData.get("isActive")?.toString() ?? null);
    if (!displayName || !code) {
      return { success: false, message: "Paket adi ve teknik kod zorunlu." };
    }

    const exists = await prisma.plan.findUnique({
      where: { code },
      select: { id: true },
    });
    if (exists) {
      return { success: false, message: "Bu teknik kod zaten kullaniliyor." };
    }

    const planDefaults = getPlanEntitlementDefaults(code);
    const limitDefaults = getPlanEntitlementLimits(code);
    const featureRows = await ensureFeatureRows(planDefaults.features);

    await prisma.$transaction(async (tx) => {
      const created = await tx.plan.create({
        data: {
          name: displayName,
          code,
          isActive,
        },
        select: { id: true },
      });

      if (featureRows.length > 0) {
        await tx.planFeature.createMany({
          data: featureRows.map((feature) => ({
            planId: created.id,
            featureId: feature.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.planLimit.createMany({
        data: ENTITLEMENT_LIMIT_RESOURCES.map((resource) => ({
          planId: created.id,
          resource: toLimitResource(resource),
          limit: limitDefaults[resource],
        })),
        skipDuplicates: true,
      });
    });

    revalidatePath("/hq/packages");
    revalidatePath("/hq/tenants");
    return { success: true, message: "Paket olusturuldu." };
  } catch {
    return { success: false, message: "Paket olusturulamadi." };
  }
}

export async function updatePackageSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    const planId = parsePositiveInt(formData.get("planId")?.toString() ?? null);
    const displayName = (formData.get("displayName")?.toString() ?? "").trim();
    const isActive = parseToggle(formData.get("isActive")?.toString() ?? null);
    const selectedFeatureCodes = parseFeatureCodes(formData.getAll("featureCodes"));
    if (!planId || !displayName) {
      return { success: false, message: "Gecersiz paket guncelleme istegi." };
    }

    const hq = await assertHqMutationGuard({
      capability: "TENANT_PLAN_MANAGE",
    });

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { id: true, code: true },
    });
    if (!plan) {
      return { success: false, message: "Paket bulunamadi." };
    }

    const parsedLimits: Record<EntitlementLimitResource, number | null> = {
      USERS: null,
      TABLES: null,
      MENUS: null,
      PRODUCTS: null,
      BRANCHES: null,
      DEVICES: null,
    };
    for (const resource of ENTITLEMENT_LIMIT_RESOURCES) {
      const value = parseLimitValue({
        mode: formData.get(`limit_${resource}_mode`)?.toString() ?? null,
        value: formData.get(`limit_${resource}_value`)?.toString() ?? null,
      });
      if (value === "INVALID") {
        return { success: false, message: `Limit degeri gecersiz: ${resource}` };
      }
      parsedLimits[resource] = value;
    }

    const featureRows = await ensureFeatureRows(selectedFeatureCodes);
    await prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          name: displayName,
          isActive,
        },
      });

      await tx.planFeature.deleteMany({
        where: { planId: plan.id },
      });
      if (featureRows.length > 0) {
        await tx.planFeature.createMany({
          data: featureRows.map((feature) => ({
            planId: plan.id,
            featureId: feature.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.planLimit.deleteMany({
        where: { planId: plan.id },
      });
      await tx.planLimit.createMany({
        data: ENTITLEMENT_LIMIT_RESOURCES.map((resource) => ({
          planId: plan.id,
          resource: toLimitResource(resource),
          limit: parsedLimits[resource],
        })),
      });
    });

    await writePlanAuditForLinkedTenants({
      actorId: `hq:${hq.username}`,
      planId: plan.id,
      actionType: "HQ_PACKAGE_SETTINGS_UPDATE",
      description: `planCode=${plan.code}; displayName=${displayName}; active=${isActive}; features=${selectedFeatureCodes.join(",")}; limits=${JSON.stringify(parsedLimits)}`,
    });

    revalidatePath("/hq/packages");
    revalidatePath("/hq/tenants");
    return { success: true, message: "Paket ayarlari guncellendi." };
  } catch {
    return { success: false, message: "Paket ayarlari guncellenemedi." };
  }
}
