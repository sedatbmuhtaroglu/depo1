import { FeatureCode, LimitResource, PlanCode } from "@prisma/client";
import {
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_LIMIT_RESOURCES,
  getPlanEntitlementDefaults,
  getPlanEntitlementLimits,
  isEntitlementFeatureCode,
  type EntitlementFeature,
  type EntitlementLimitResource,
} from "@/core/entitlements/engine";
import {
  formatLimitValue,
  getFeatureGroupLabel,
  getFeaturePresentation,
  getLimitPresentation,
  type TenantFeatureGroupKey,
} from "@/modules/hq/server/tenant-package-feature-labels";
import { prisma } from "@/lib/prisma";

export type HqPackageListItem = {
  id: number;
  displayName: string;
  code: string;
  isActive: boolean;
  featureCount: number;
  limitSummary: string;
  tenantCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type HqPackageDetail = {
  id: number;
  displayName: string;
  code: PlanCode;
  isActive: boolean;
  tenantCount: number;
  createdAt: Date;
  updatedAt: Date;
  featuresByGroup: Array<{
    key: TenantFeatureGroupKey;
    label: string;
    items: Array<{ code: EntitlementFeature; label: string; enabled: boolean }>;
  }>;
  limits: Array<{
    resource: EntitlementLimitResource;
    label: string;
    value: number | null;
  }>;
};

export type HqPackagesPageData = {
  packages: HqPackageListItem[];
  selectedPackage: HqPackageDetail | null;
  availableCodesForCreate: PlanCode[];
};

function featureGroupOrder(): TenantFeatureGroupKey[] {
  return [
    "MENU",
    "OPERATIONS",
    "MANAGEMENT",
    "FINANCE_PAYMENT",
    "CALL_LOG",
    "SHOWCASE",
    "REPORTING",
    "DOMAIN_PUBLISH",
    "STOCK",
    "STAFF",
    "OTHER",
  ];
}

function buildLimitSummary(input: { code: PlanCode; planLimits: Array<{ resource: LimitResource; limit: number | null }> }) {
  const dbMap = new Map<EntitlementLimitResource, number | null>();
  for (const row of input.planLimits) {
    dbMap.set(row.resource as EntitlementLimitResource, row.limit);
  }
  const effective = getPlanEntitlementLimits(input.code);
  for (const resource of ENTITLEMENT_LIMIT_RESOURCES) {
    if (dbMap.has(resource)) {
      effective[resource] = dbMap.get(resource) ?? null;
    }
  }
  return ENTITLEMENT_LIMIT_RESOURCES.slice(0, 3)
    .map((resource) => `${getLimitPresentation(resource).shortLabel}: ${formatLimitValue(effective[resource])}`)
    .join(" | ");
}

function normalizeFeatureCode(code: FeatureCode): EntitlementFeature | null {
  return isEntitlementFeatureCode(code) ? code : null;
}

function defaultFeatureSet(planCode: PlanCode): Set<EntitlementFeature> {
  return new Set(getPlanEntitlementDefaults(planCode).features);
}

function groupFeatureRows(input: {
  planCode: PlanCode;
  selectedFeatureCodes: Set<EntitlementFeature>;
  manageableFeatures: Array<{ code: string; name: string }>;
}) {
  const manageableNameMap = new Map(input.manageableFeatures.map((item) => [item.code, item.name]));
  const featureCodes = new Set<EntitlementFeature>(ENTITLEMENT_FEATURES);
  for (const code of defaultFeatureSet(input.planCode)) featureCodes.add(code);
  for (const code of input.selectedFeatureCodes) featureCodes.add(code);

  const grouped = new Map<TenantFeatureGroupKey, Array<{ code: EntitlementFeature; label: string; enabled: boolean }>>();
  for (const code of featureCodes) {
    const presentation = getFeaturePresentation({
      code,
      fallbackName: manageableNameMap.get(code) ?? null,
    });
    const list = grouped.get(presentation.group) ?? [];
    list.push({
      code,
      label: presentation.label,
      enabled: input.selectedFeatureCodes.has(code),
    });
    grouped.set(presentation.group, list);
  }

  return featureGroupOrder()
    .map((group) => ({
      key: group,
      label: getFeatureGroupLabel(group),
      items: (grouped.get(group) ?? []).sort((a, b) => a.label.localeCompare(b.label, "tr")),
    }))
    .filter((group) => group.items.length > 0);
}

function resolvePlanLimits(input: {
  code: PlanCode;
  planLimits: Array<{ resource: LimitResource; limit: number | null }>;
}) {
  const effective = getPlanEntitlementLimits(input.code);
  for (const row of input.planLimits) {
    const resource = row.resource as EntitlementLimitResource;
    effective[resource] = row.limit;
  }
  return ENTITLEMENT_LIMIT_RESOURCES.map((resource) => ({
    resource,
    label: getLimitPresentation(resource).label,
    value: effective[resource],
  }));
}

export async function getHqPackagesPageData(selectedPlanId?: number | null): Promise<HqPackagesPageData> {
  const [plans, manageableFeatures] = await Promise.all([
    prisma.plan.findMany({
      orderBy: [{ id: "asc" }],
      include: {
        planFeatures: {
          include: { feature: { select: { code: true } } },
        },
        planLimits: {
          select: { resource: true, limit: true },
        },
        _count: {
          select: { tenants: true },
        },
      },
    }),
    prisma.feature.findMany({
      orderBy: { id: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  const packages: HqPackageListItem[] = plans.map((plan) => ({
    id: plan.id,
    displayName: plan.name,
    code: String(plan.code),
    isActive: plan.isActive,
    featureCount: plan.planFeatures.length,
    limitSummary: buildLimitSummary({
      code: plan.code,
      planLimits: plan.planLimits,
    }),
    tenantCount: plan._count.tenants,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }));

  const selected =
    (selectedPlanId ? plans.find((item) => item.id === selectedPlanId) : plans[0]) ?? null;

  const selectedPackage: HqPackageDetail | null = selected
    ? {
        id: selected.id,
        displayName: selected.name,
        code: selected.code,
        isActive: selected.isActive,
        tenantCount: selected._count.tenants,
        createdAt: selected.createdAt,
        updatedAt: selected.updatedAt,
        featuresByGroup: groupFeatureRows({
          planCode: selected.code,
          selectedFeatureCodes: new Set(
            selected.planFeatures
              .map((row) => normalizeFeatureCode(row.feature.code))
              .filter((code): code is EntitlementFeature => code != null),
          ),
          manageableFeatures: manageableFeatures.map((row) => ({
            code: String(row.code),
            name: row.name,
          })),
        }),
        limits: resolvePlanLimits({
          code: selected.code,
          planLimits: selected.planLimits,
        }),
      }
    : null;

  const existingCodes = new Set(plans.map((plan) => plan.code));
  const availableCodesForCreate = Object.values(PlanCode).filter((code) => !existingCodes.has(code));

  return {
    packages,
    selectedPackage,
    availableCodesForCreate,
  };
}
