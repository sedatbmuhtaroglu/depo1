import {
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_LIMIT_RESOURCES,
  getLifecycleForcedDisabledFeatures,
  getPlanEntitlementDefaults,
  getPlanEntitlementLimits,
  isEntitlementFeatureCode,
  type EntitlementFeature,
  type EntitlementLimitResource,
  type TenantEntitlements,
} from "@/core/entitlements/engine";
import {
  formatFeatureEnabled,
  getFeatureGroupLabel,
  getFeaturePresentation,
  getLimitPresentation,
  type TenantFeatureGroupKey,
} from "@/modules/hq/server/tenant-package-feature-labels";

type ManageableFeature = {
  code: string;
  name: string;
  description: string | null;
};

type TenantUsage = {
  users: number;
  tables: number;
  menus: number;
  products: number;
  restaurants: number;
};

type FeatureOverrideState = "DEFAULT" | "ENABLED" | "DISABLED";

type FeatureRow = {
  code: EntitlementFeature;
  label: string;
  shortLabel: string;
  group: TenantFeatureGroupKey;
  planEnabled: boolean;
  overrideState: FeatureOverrideState;
  overrideEnabled: boolean | null;
  effectiveEnabled: boolean;
  lifecycleLocked: boolean;
  effectiveReason: string;
};

type LimitRow = {
  resource: EntitlementLimitResource;
  label: string;
  shortLabel: string;
  planValue: number | null;
  overrideValue: number | null | undefined;
  effectiveValue: number | null;
  isOverridden: boolean;
  differsFromPackage: boolean;
  used: number | null;
};

export type TenantPackageFeaturesView = {
  summary: {
    activePlanName: string;
    tenantStatus: string;
    hasOverrides: boolean;
    totalEffectiveFeatures: number;
    criticalLimits: Array<{ label: string; text: string }>;
  };
  packageFeatures: Array<{
    key: TenantFeatureGroupKey;
    label: string;
    items: FeatureRow[];
  }>;
  limits: LimitRow[];
  overridden: {
    features: FeatureRow[];
    limits: LimitRow[];
    differsFromPackage: {
      features: FeatureRow[];
      limits: LimitRow[];
    };
  };
  effective: {
    featuresByGroup: Array<{
      key: TenantFeatureGroupKey;
      label: string;
      items: FeatureRow[];
    }>;
    limits: LimitRow[];
  };
};

type ResolveTenantPackageFeaturesInput = {
  tenant: {
    planName: string;
    lifecycleStatus: string;
  };
  usage: TenantUsage;
  entitlements: TenantEntitlements;
  featureOverrides: Array<{ featureCode: string; enabled: boolean }>;
  limitOverrides: Array<{ resource: string; limit: number | null }>;
  planFeatureCodes: string[];
  planLimits: Array<{ resource: string; limit: number | null }>;
  manageableFeatures: ManageableFeature[];
};

function toFeatureOverrideState(value: boolean | undefined): FeatureOverrideState {
  if (value === undefined) return "DEFAULT";
  return value ? "ENABLED" : "DISABLED";
}

function mapUsage(resource: EntitlementLimitResource, usage: TenantUsage): number | null {
  if (resource === "USERS") return usage.users;
  if (resource === "TABLES") return usage.tables;
  if (resource === "MENUS") return usage.menus;
  if (resource === "PRODUCTS") return usage.products;
  if (resource === "BRANCHES") return usage.restaurants;
  return null;
}

function sortGroups(
  grouped: Map<TenantFeatureGroupKey, FeatureRow[]>,
): Array<{ key: TenantFeatureGroupKey; label: string; items: FeatureRow[] }> {
  const groupOrder: TenantFeatureGroupKey[] = [
    "MENU",
    "OPERATIONS",
    "MANAGEMENT",
    "FINANCE_PAYMENT",
    "CALL_LOG",
    "SHOWCASE",
    "DOMAIN_PUBLISH",
    "REPORTING",
    "STOCK",
    "STAFF",
    "OTHER",
  ];
  return groupOrder
    .map((key) => ({
      key,
      label: getFeatureGroupLabel(key),
      items: (grouped.get(key) ?? []).sort((a, b) => a.label.localeCompare(b.label, "tr")),
    }))
    .filter((group) => group.items.length > 0);
}

function buildFeatureCatalog(input: {
  manageableFeatures: ManageableFeature[];
  planFeatureSet: Set<EntitlementFeature>;
  featureOverrideMap: Map<EntitlementFeature, boolean>;
  effectiveFeatureSet: Set<EntitlementFeature>;
  lifecycleLockedSet: Set<EntitlementFeature>;
}): FeatureRow[] {
  const manageableNameMap = new Map<string, string>();
  for (const feature of input.manageableFeatures) {
    manageableNameMap.set(feature.code, feature.name);
  }

  const featureCodes = new Set<EntitlementFeature>();
  for (const code of ENTITLEMENT_FEATURES) {
    featureCodes.add(code);
  }
  for (const code of input.planFeatureSet) {
    featureCodes.add(code);
  }
  for (const code of input.featureOverrideMap.keys()) {
    featureCodes.add(code);
  }
  for (const code of input.effectiveFeatureSet) {
    featureCodes.add(code);
  }

  return Array.from(featureCodes).map((code) => {
    const presentation = getFeaturePresentation({
      code,
      fallbackName: manageableNameMap.get(code) ?? null,
    });
    const overrideEnabled = input.featureOverrideMap.get(code);
    const planEnabled = input.planFeatureSet.has(code);
    const effectiveEnabled = input.effectiveFeatureSet.has(code);
    const lifecycleLocked = input.lifecycleLockedSet.has(code) && !effectiveEnabled;
    const overrideState = toFeatureOverrideState(overrideEnabled);

    let effectiveReason = effectiveEnabled ? "Paket kurali ile acik" : "Paket kurali ile kapali";
    if (overrideState === "ENABLED") {
      effectiveReason = "Tenant override ile acik";
    } else if (overrideState === "DISABLED") {
      effectiveReason = "Tenant override ile kapali";
    }
    if (lifecycleLocked) {
      effectiveReason = "Lifecycle kurali nedeniyle kilitli";
    }

    return {
      code,
      label: presentation.label,
      shortLabel: presentation.shortLabel,
      group: presentation.group,
      planEnabled,
      overrideState,
      overrideEnabled: overrideEnabled ?? null,
      effectiveEnabled,
      lifecycleLocked,
      effectiveReason,
    } satisfies FeatureRow;
  });
}

function buildLimitRows(input: {
  planCode: TenantEntitlements["planCode"];
  effectiveLimits: TenantEntitlements["limits"];
  limitOverrides: Array<{ resource: string; limit: number | null }>;
  planLimits: Array<{ resource: string; limit: number | null }>;
  usage: TenantUsage;
}): LimitRow[] {
  const packageLimits = getPlanEntitlementLimits(input.planCode);
  for (const row of input.planLimits) {
    if (!ENTITLEMENT_LIMIT_RESOURCES.includes(row.resource as EntitlementLimitResource)) {
      continue;
    }
    packageLimits[row.resource as EntitlementLimitResource] = row.limit;
  }
  const overrideMap = new Map<EntitlementLimitResource, number | null>();
  for (const row of input.limitOverrides) {
    if (!ENTITLEMENT_LIMIT_RESOURCES.includes(row.resource as EntitlementLimitResource)) {
      continue;
    }
    overrideMap.set(row.resource as EntitlementLimitResource, row.limit);
  }

  return ENTITLEMENT_LIMIT_RESOURCES.map((resource) => {
    const presentation = getLimitPresentation(resource);
    const planValue = packageLimits[resource];
    const overrideValue = overrideMap.get(resource);
    const effectiveValue = input.effectiveLimits[resource];
    return {
      resource,
      label: presentation.label,
      shortLabel: presentation.shortLabel,
      planValue,
      overrideValue,
      effectiveValue,
      isOverridden: overrideMap.has(resource),
      differsFromPackage: effectiveValue !== planValue,
      used: mapUsage(resource, input.usage),
    } satisfies LimitRow;
  });
}

export function resolveTenantPackageFeaturesView(
  input: ResolveTenantPackageFeaturesInput,
): TenantPackageFeaturesView {
  const planCode = input.entitlements.planCode;
  const planDefaults = getPlanEntitlementDefaults(planCode);
  const effectiveFeatureSet = new Set<EntitlementFeature>(input.entitlements.features);
  const featureOverrideMap = new Map<EntitlementFeature, boolean>();
  for (const row of input.featureOverrides) {
    if (!isEntitlementFeatureCode(row.featureCode)) continue;
    featureOverrideMap.set(row.featureCode, row.enabled);
  }

  const planFeatureSet = new Set<EntitlementFeature>(planDefaults.features);
  for (const code of input.planFeatureCodes) {
    if (!isEntitlementFeatureCode(code)) continue;
    planFeatureSet.add(code);
  }

  const lifecycleLockedSet = new Set<EntitlementFeature>(
    getLifecycleForcedDisabledFeatures(input.entitlements.lifecycleStatus),
  );

  const featureRows = buildFeatureCatalog({
    manageableFeatures: input.manageableFeatures,
    planFeatureSet,
    featureOverrideMap,
    effectiveFeatureSet,
    lifecycleLockedSet,
  });

  const grouped = new Map<TenantFeatureGroupKey, FeatureRow[]>();
  for (const row of featureRows) {
    const list = grouped.get(row.group) ?? [];
    list.push(row);
    grouped.set(row.group, list);
  }

  const packageFeatures = sortGroups(grouped);
  const limits = buildLimitRows({
    planCode,
    effectiveLimits: input.entitlements.limits,
    limitOverrides: input.limitOverrides,
    planLimits: input.planLimits,
    usage: input.usage,
  });

  const overriddenFeatures = featureRows.filter((row) => row.overrideState !== "DEFAULT");
  const overriddenLimits = limits.filter((row) => row.isOverridden);
  const differsFeatures = featureRows.filter((row) => row.planEnabled !== row.effectiveEnabled);
  const differsLimits = limits.filter((row) => row.differsFromPackage);

  const criticalLimits = limits
    .slice()
    .sort((a, b) => {
      const left = getLimitPresentation(a.resource).summaryPriority;
      const right = getLimitPresentation(b.resource).summaryPriority;
      return left - right;
    })
    .slice(0, 4)
    .map((row) => {
      const usedText = row.used == null ? "-" : String(row.used);
      const maxText = row.effectiveValue == null ? "Sinirsiz" : String(row.effectiveValue);
      return {
        label: row.shortLabel,
        text: `${usedText} / ${maxText}`,
      };
    });

  return {
    summary: {
      activePlanName: input.tenant.planName,
      tenantStatus: input.tenant.lifecycleStatus,
      hasOverrides: overriddenFeatures.length > 0 || overriddenLimits.length > 0,
      totalEffectiveFeatures: featureRows.filter((row) => row.effectiveEnabled).length,
      criticalLimits,
    },
    packageFeatures,
    limits,
    overridden: {
      features: overriddenFeatures,
      limits: overriddenLimits,
      differsFromPackage: {
        features: differsFeatures,
        limits: differsLimits,
      },
    },
    effective: {
      featuresByGroup: packageFeatures,
      limits,
    },
  };
}

export function getFeatureOverrideStateLabel(state: FeatureOverrideState): string {
  if (state === "ENABLED") return "Açık (tenant override)";
  if (state === "DISABLED") return "Kapalı (tenant override)";
  return "Varsayılan";
}

export function getFeatureEffectiveLabel(value: boolean): string {
  return formatFeatureEnabled(value);
}
