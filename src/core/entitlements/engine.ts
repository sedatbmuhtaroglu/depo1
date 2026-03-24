import { FeatureCode, LimitResource, PlanCode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTenantLifecycleSnapshot,
  type TenantLifecycleStatus,
} from "@/core/tenancy/lifecycle-policy";

export const ENTITLEMENT_FEATURES = [
  "MENU",
  "WAITER_CALL",
  "ORDERING",
  "CUSTOM_DOMAIN",
  "INVOICING",
  "ADVANCED_REPORTS",
  "KITCHEN_DISPLAY",
  "ANALYTICS",
] as const;

export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];

export const ENTITLEMENT_LIMIT_RESOURCES = [
  "USERS",
  "TABLES",
  "MENUS",
  "PRODUCTS",
  "BRANCHES",
  "DEVICES",
] as const;

export type EntitlementLimitResource = (typeof ENTITLEMENT_LIMIT_RESOURCES)[number];

export type EntitlementLimits = Record<EntitlementLimitResource, number | null>;

export type TenantEntitlements = {
  tenantId: number;
  planCode: PlanCode;
  lifecycleStatus: TenantLifecycleStatus;
  features: Set<EntitlementFeature>;
  limits: EntitlementLimits;
  limitOverrides: Partial<Record<EntitlementLimitResource, number | null>>;
};

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

type PlanEntitlementDefaults = {
  features: readonly EntitlementFeature[];
  limits: EntitlementLimits;
};

const PLAN_ENTITLEMENT_DEFAULTS: Record<PlanCode, PlanEntitlementDefaults> = {
  MINI: {
    features: ["MENU", "ORDERING"],
    limits: {
      USERS: 5,
      TABLES: 20,
      MENUS: 2,
      PRODUCTS: 150,
      BRANCHES: 1,
      DEVICES: 3,
    },
  },
  RESTAURANT: {
    features: ["MENU", "ORDERING", "WAITER_CALL", "KITCHEN_DISPLAY", "INVOICING"],
    limits: {
      USERS: 15,
      TABLES: 60,
      MENUS: 6,
      PRODUCTS: 600,
      BRANCHES: 3,
      DEVICES: 15,
    },
  },
  CORPORATE: {
    features: [
      "MENU",
      "ORDERING",
      "WAITER_CALL",
      "KITCHEN_DISPLAY",
      "INVOICING",
      "CUSTOM_DOMAIN",
      "ADVANCED_REPORTS",
      "ANALYTICS",
    ],
    limits: {
      USERS: null,
      TABLES: null,
      MENUS: null,
      PRODUCTS: null,
      BRANCHES: null,
      DEVICES: null,
    },
  },
};

const LIFECYCLE_FORCED_DISABLED_FEATURES: Partial<
  Record<TenantLifecycleStatus, readonly EntitlementFeature[]>
> = {
  SUSPENDED: ["ORDERING", "WAITER_CALL", "INVOICING"],
  CANCELED: ["ORDERING", "WAITER_CALL", "INVOICING"],
  PAST_DUE: ["ORDERING"],
  DRAFT: ["ORDERING", "WAITER_CALL", "INVOICING"],
  PENDING_SETUP: [],
  TRIAL: [],
  ACTIVE: [],
};

const FEATURE_CODES = new Set<EntitlementFeature>(
  Object.values(FeatureCode).filter((value): value is EntitlementFeature =>
    ENTITLEMENT_FEATURES.includes(value as EntitlementFeature),
  ),
);

function parseEnvLimit(raw: string | undefined): number | null | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized === "null" ||
    normalized === "none" ||
    normalized === "unlimited" ||
    normalized === "infinity" ||
    normalized === "sinirsiz" ||
    normalized === "-1"
  ) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function getPlanEnvLimit(planCode: PlanCode, resource: EntitlementLimitResource) {
  const legacySuffixByResource: Record<EntitlementLimitResource, string> = {
    USERS: "MAX_USERS",
    TABLES: "MAX_TABLES",
    MENUS: "MAX_MENUS",
    PRODUCTS: "MAX_PRODUCTS",
    BRANCHES: "MAX_BRANCHES",
    DEVICES: "MAX_DEVICES",
  };
  const modernKey = `TENANT_LIMIT_${planCode}_${resource}`;
  const legacyKey = `TENANT_LIMIT_${planCode}_${legacySuffixByResource[resource]}`;
  return parseEnvLimit(process.env[modernKey]) ?? parseEnvLimit(process.env[legacyKey]);
}

function applyPlanEnvOverrides(
  planCode: PlanCode,
  defaults: EntitlementLimits,
): EntitlementLimits {
  return ENTITLEMENT_LIMIT_RESOURCES.reduce<EntitlementLimits>(
    (acc, resource) => {
      const envValue = getPlanEnvLimit(planCode, resource);
      acc[resource] = envValue !== undefined ? envValue : defaults[resource];
      return acc;
    },
    { ...defaults },
  );
}

function normalizeDbFeatureToEntitlement(featureCode: FeatureCode): EntitlementFeature | null {
  if (!FEATURE_CODES.has(featureCode as EntitlementFeature)) {
    return null;
  }
  return featureCode as EntitlementFeature;
}

function normalizeLimitResource(resource: LimitResource): EntitlementLimitResource {
  return resource as EntitlementLimitResource;
}

function applyLifecycleFeatureGuards(
  status: TenantLifecycleStatus,
  features: Set<EntitlementFeature>,
) {
  const disabled = LIFECYCLE_FORCED_DISABLED_FEATURES[status] ?? [];
  for (const feature of disabled) {
    features.delete(feature);
  }
}

function applyTenantLimitOverrides(input: {
  baseLimits: EntitlementLimits;
  overrides: Array<{ resource: LimitResource; limit: number | null }>;
}) {
  const effective: EntitlementLimits = { ...input.baseLimits };
  const appliedOverrides: Partial<Record<EntitlementLimitResource, number | null>> = {};

  for (const override of input.overrides) {
    const resource = normalizeLimitResource(override.resource);
    effective[resource] = override.limit;
    appliedOverrides[resource] = override.limit;
  }

  return {
    effectiveLimits: effective,
    appliedOverrides,
  };
}

export class EntitlementFeatureDisabledError extends Error {
  readonly code: "FEATURE_DISABLED";
  readonly feature: EntitlementFeature;

  constructor(feature: EntitlementFeature) {
    super(`Feature is not enabled for this tenant: ${feature}`);
    this.name = "EntitlementFeatureDisabledError";
    this.code = "FEATURE_DISABLED";
    this.feature = feature;
  }
}

export class EntitlementLimitExceededError extends Error {
  readonly code: "LIMIT_EXCEEDED";
  readonly resource: EntitlementLimitResource;
  readonly used: number;
  readonly max: number;

  constructor(input: { resource: EntitlementLimitResource; used: number; max: number }) {
    super(`Tenant limit exceeded for ${input.resource}: ${input.used}/${input.max}`);
    this.name = "EntitlementLimitExceededError";
    this.code = "LIMIT_EXCEEDED";
    this.resource = input.resource;
    this.used = input.used;
    this.max = input.max;
  }
}

export async function getTenantEntitlements(
  tenantId: number,
  client: PrismaClientLike = prisma,
): Promise<TenantEntitlements> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    include: {
      plan: {
        include: {
          planFeatures: {
            include: {
              feature: {
                select: { code: true },
              },
            },
          },
        },
      },
      features: {
        include: {
          feature: {
            select: { code: true },
          },
        },
      },
      limitOverrides: {
        select: { resource: true, limit: true },
      },
    },
  });

  if (!tenant || !tenant.plan) {
    throw new Error("TENANT_PLAN_NOT_FOUND");
  }

  const lifecycle = await getTenantLifecycleSnapshot(tenantId, client);
  const planDefaults = PLAN_ENTITLEMENT_DEFAULTS[tenant.plan.code];
  const featureSet = new Set<EntitlementFeature>(planDefaults.features);

  for (const row of tenant.plan.planFeatures) {
    const code = normalizeDbFeatureToEntitlement(row.feature.code);
    if (code) {
      featureSet.add(code);
    }
  }

  for (const override of tenant.features) {
    const code = normalizeDbFeatureToEntitlement(override.feature.code);
    if (!code) continue;
    if (override.enabled) {
      featureSet.add(code);
    } else {
      featureSet.delete(code);
    }
  }

  applyLifecycleFeatureGuards(lifecycle.normalizedStatus, featureSet);

  const baseLimits = applyPlanEnvOverrides(tenant.plan.code, planDefaults.limits);
  const { effectiveLimits, appliedOverrides } = applyTenantLimitOverrides({
    baseLimits,
    overrides: tenant.limitOverrides,
  });

  return {
    tenantId,
    planCode: tenant.plan.code,
    lifecycleStatus: lifecycle.normalizedStatus,
    features: featureSet,
    limits: effectiveLimits,
    limitOverrides: appliedOverrides,
  };
}

export async function hasFeature(
  tenantId: number,
  feature: EntitlementFeature,
  client: PrismaClientLike = prisma,
): Promise<boolean> {
  const entitlements = await getTenantEntitlements(tenantId, client);
  return entitlements.features.has(feature);
}

export async function assertFeatureEnabled(
  tenantId: number,
  feature: EntitlementFeature,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const enabled = await hasFeature(tenantId, feature, client);
  if (!enabled) {
    throw new EntitlementFeatureDisabledError(feature);
  }
}

export async function getLimit(
  tenantId: number,
  resource: EntitlementLimitResource,
  client: PrismaClientLike = prisma,
): Promise<number | null> {
  const entitlements = await getTenantEntitlements(tenantId, client);
  return entitlements.limits[resource];
}

export async function assertWithinLimit(input: {
  tenantId: number;
  resource: EntitlementLimitResource;
  used: number;
  client?: PrismaClientLike;
}): Promise<{ max: number | null }> {
  const max = await getLimit(input.tenantId, input.resource, input.client);
  if (max == null) {
    return { max: null };
  }
  if (input.used >= max) {
    throw new EntitlementLimitExceededError({
      resource: input.resource,
      used: input.used,
      max,
    });
  }
  return { max };
}
