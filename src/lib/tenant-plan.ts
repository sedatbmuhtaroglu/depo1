import { FeatureCode, type Plan } from "@prisma/client";
import { getTenantEntitlements, hasFeature } from "@/core/entitlements/engine";
import { prisma } from "@/lib/prisma";

const FEATURE_CODES = new Set<string>(Object.values(FeatureCode));

export async function getTenantPlan(tenantId: number): Promise<Plan | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });
  return tenant?.plan ?? null;
}

export async function getTenantFeatures(tenantId: number): Promise<FeatureCode[]> {
  const entitlements = await getTenantEntitlements(tenantId);
  return Array.from(entitlements.features).filter((feature): feature is FeatureCode =>
    FEATURE_CODES.has(feature),
  );
}

export async function tenantHasFeature(
  tenantId: number,
  featureCode: FeatureCode,
): Promise<boolean> {
  return hasFeature(tenantId, featureCode);
}
