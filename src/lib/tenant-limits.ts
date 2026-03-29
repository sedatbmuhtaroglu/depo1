import { PlanCode, Prisma } from "@prisma/client";
import {
  EntitlementLimitExceededError,
  getTenantEntitlements,
} from "@/core/entitlements/engine";
import { prisma } from "@/lib/prisma";

export type TenantLimitResource = "USERS" | "TABLES" | "MENUS" | "PRODUCTS";

export type TenantLimitValues = {
  maxUsers: number | null;
  maxTables: number | null;
  maxMenus: number | null;
  maxProducts: number | null;
};

export type TenantResourceUsage = {
  resource: TenantLimitResource;
  used: number;
  max: number | null;
  remaining: number | null;
  reached: boolean;
};

export type TenantLimitSnapshot = TenantLimitValues & {
  tenantId: number;
  planCode: PlanCode;
  source: "entitlements-effective";
};

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

const LIMIT_FIELD_BY_RESOURCE: Record<TenantLimitResource, keyof TenantLimitValues> = {
  USERS: "maxUsers",
  TABLES: "maxTables",
  MENUS: "maxMenus",
  PRODUCTS: "maxProducts",
};

const RESOURCE_LABELS: Record<TenantLimitResource, string> = {
  USERS: "Kullanici",
  TABLES: "Masa",
  MENUS: "Menu",
  PRODUCTS: "Urun",
};

const RESOURCE_NOUNS: Record<TenantLimitResource, string> = {
  USERS: "kullanici",
  TABLES: "masa",
  MENUS: "menu",
  PRODUCTS: "urun",
};

async function countResource(
  tenantId: number,
  resource: TenantLimitResource,
  client: PrismaClientLike,
) {
  switch (resource) {
    case "USERS":
      return client.tenantStaff.count({
        where: { tenantId, isActive: true },
      });
    case "TABLES":
      return client.table.count({
        where: { restaurant: { tenantId } },
      });
    case "MENUS":
      return client.menu.count({
        where: { tenantId },
      });
    case "PRODUCTS":
      return client.product.count({
        where: { category: { restaurant: { tenantId } } },
      });
    default:
      return 0;
  }
}

function buildReachedMessage(resource: TenantLimitResource, used: number, max: number) {
  const label = RESOURCE_LABELS[resource];
  const noun = RESOURCE_NOUNS[resource];
  return `${label} limitine ulastiniz. (${used}/${max} ${noun})`;
}

export class TenantLimitExceededError extends Error {
  resource: TenantLimitResource;
  used: number;
  max: number;

  constructor(params: { resource: TenantLimitResource; used: number; max: number }) {
    super(buildReachedMessage(params.resource, params.used, params.max));
    this.name = "TenantLimitExceededError";
    this.resource = params.resource;
    this.used = params.used;
    this.max = params.max;
  }
}

export function isTenantLimitExceededError(error: unknown): error is TenantLimitExceededError {
  return error instanceof TenantLimitExceededError;
}

export async function resolveTenantLimits(
  tenantId: number,
  client: PrismaClientLike = prisma,
): Promise<TenantLimitSnapshot> {
  const entitlements = await getTenantEntitlements(tenantId, client);
  return {
    tenantId,
    planCode: entitlements.planCode,
    source: "entitlements-effective",
    maxUsers: entitlements.limits.USERS,
    maxTables: entitlements.limits.TABLES,
    maxMenus: entitlements.limits.MENUS,
    maxProducts: entitlements.limits.PRODUCTS,
  };
}

export async function getTenantResourceUsage(
  tenantId: number,
  resource: TenantLimitResource,
  client: PrismaClientLike = prisma,
): Promise<TenantResourceUsage> {
  const limits = await resolveTenantLimits(tenantId, client);
  const used = await countResource(tenantId, resource, client);
  const max = limits[LIMIT_FIELD_BY_RESOURCE[resource]];
  const reached = max != null ? used >= max : false;
  const remaining = max != null ? Math.max(max - used, 0) : null;

  return {
    resource,
    used,
    max,
    reached,
    remaining,
  };
}

export async function getTenantLimitUsageSummary(
  tenantId: number,
  client: PrismaClientLike = prisma,
) {
  const [limits, users, tables, menus, products] = await Promise.all([
    resolveTenantLimits(tenantId, client),
    countResource(tenantId, "USERS", client),
    countResource(tenantId, "TABLES", client),
    countResource(tenantId, "MENUS", client),
    countResource(tenantId, "PRODUCTS", client),
  ]);

  return {
    limits,
    usage: {
      users: {
        used: users,
        max: limits.maxUsers,
      },
      tables: {
        used: tables,
        max: limits.maxTables,
      },
      menus: {
        used: menus,
        max: limits.maxMenus,
      },
      products: {
        used: products,
        max: limits.maxProducts,
      },
    },
  };
}

export async function assertTenantLimit(
  tenantId: number,
  resource: TenantLimitResource,
  client: PrismaClientLike = prisma,
) {
  const usage = await getTenantResourceUsage(tenantId, resource, client);
  if (usage.max == null) {
    return usage;
  }
  if (usage.used >= usage.max) {
    throw new TenantLimitExceededError({
      resource,
      used: usage.used,
      max: usage.max,
    });
  }
  return usage;
}

export function fromEntitlementLimitError(
  error: EntitlementLimitExceededError,
): TenantLimitExceededError {
  return new TenantLimitExceededError({
    resource: error.resource as TenantLimitResource,
    used: error.used,
    max: error.max,
  });
}
