import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SecuritySurface, SurfaceAccessOperation } from "@/core/surfaces/types";

export const TENANT_LIFECYCLE_STATUSES = [
  "DRAFT",
  "PENDING_SETUP",
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELED",
] as const;

export type TenantLifecycleStatus = (typeof TENANT_LIFECYCLE_STATUSES)[number];

export type TenantLifecycleSnapshot = {
  tenantId: number;
  rawStatus: string;
  normalizedStatus: TenantLifecycleStatus;
  setupCompleted: boolean;
  setupStep: string | null;
};

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

type TenantLifecycleStateRow = {
  tenantId: number;
  status: string;
  setupCompleted: boolean;
  setupStep?: string | null;
};

const ACTIVE_TENANT_SURFACES = new Set<SecuritySurface>([
  "ops-private",
  "waiter-private",
  "kitchen-private",
  "storefront-public",
  "hq-private",
  "internal-admin",
  "payment-webhook",
]);

const OPS_RECOVERY_SURFACES = new Set<SecuritySurface>([
  "ops-private",
  "waiter-private",
  "kitchen-private",
  "hq-private",
  "internal-admin",
  "payment-webhook",
]);

const HQ_ONLY_SURFACES = new Set<SecuritySurface>([
  "hq-private",
  "internal-admin",
  "payment-webhook",
]);

export class TenantLifecycleAccessError extends Error {
  readonly code: "TENANT_LIFECYCLE_BLOCKED";
  readonly status: TenantLifecycleStatus;
  readonly surface: SecuritySurface;
  readonly operation: SurfaceAccessOperation;

  constructor(input: {
    status: TenantLifecycleStatus;
    surface: SecuritySurface;
    operation: SurfaceAccessOperation;
  }) {
    super(
      `Tenant lifecycle "${input.status}" cannot access ${input.surface} (${input.operation}).`,
    );
    this.name = "TenantLifecycleAccessError";
    this.code = "TENANT_LIFECYCLE_BLOCKED";
    this.status = input.status;
    this.surface = input.surface;
    this.operation = input.operation;
  }
}

function normalizeLifecycleStatus(row: {
  status: string;
  setupCompleted: boolean;
  setupStep?: string | null;
}): TenantLifecycleStatus {
  const raw = (row.status || "").trim().toUpperCase();
  const setupStep = (row.setupStep || "").trim().toUpperCase();

  if (raw === "DRAFT") return "DRAFT";
  if (raw === "PENDING_SETUP") return "PENDING_SETUP";
  if (raw === "TRIAL") return "TRIAL";
  if (raw === "PAST_DUE") return "PAST_DUE";
  if (raw === "SUSPENDED") return "SUSPENDED";
  if (raw === "CANCELED") return "CANCELED";
  if (raw === "EXPIRED") return "PAST_DUE";
  if (raw === "ACTIVE") {
    if (setupStep === "TRIAL") return "TRIAL";
    if (setupStep === "DRAFT") return "DRAFT";
    return row.setupCompleted ? "ACTIVE" : "PENDING_SETUP";
  }

  return "SUSPENDED";
}

function isStatusAllowedOnSurface(input: {
  status: TenantLifecycleStatus;
  surface: SecuritySurface;
  operation: SurfaceAccessOperation;
}): boolean {
  const { status, surface, operation } = input;

  if (status === "ACTIVE" || status === "TRIAL") {
    return ACTIVE_TENANT_SURFACES.has(surface);
  }

  if (status === "PENDING_SETUP") {
    return ACTIVE_TENANT_SURFACES.has(surface);
  }

  if (status === "DRAFT") {
    return surface === "ops-private" || HQ_ONLY_SURFACES.has(surface);
  }

  if (status === "PAST_DUE") {
    if (!OPS_RECOVERY_SURFACES.has(surface)) return false;
    if (surface === "storefront-public" && operation === "mutation") return false;
    return true;
  }

  if (status === "SUSPENDED" || status === "CANCELED") {
    return HQ_ONLY_SURFACES.has(surface);
  }

  return false;
}

export function resolveTenantLifecycleSnapshotFromRow(
  row: TenantLifecycleStateRow,
): TenantLifecycleSnapshot {
  return {
    tenantId: row.tenantId,
    rawStatus: row.status,
    normalizedStatus: normalizeLifecycleStatus({
      status: row.status,
      setupCompleted: row.setupCompleted,
      setupStep: row.setupStep ?? null,
    }),
    setupCompleted: row.setupCompleted,
    setupStep: row.setupStep ?? null,
  };
}

export async function getTenantLifecycleSnapshot(
  tenantId: number,
  client: PrismaClientLike = prisma,
): Promise<TenantLifecycleSnapshot> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      status: true,
      setupCompleted: true,
      setupProgress: {
        select: { currentStep: true },
      },
    },
  });

  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  return resolveTenantLifecycleSnapshotFromRow({
    tenantId: tenant.id,
    status: String(tenant.status),
    setupCompleted: tenant.setupCompleted,
    setupStep: tenant.setupProgress?.currentStep ?? null,
  });
}

export async function assertTenantLifecycleSurfaceAccess(input: {
  tenantId: number;
  surface: SecuritySurface;
  operation: SurfaceAccessOperation;
  client?: PrismaClientLike;
}): Promise<TenantLifecycleSnapshot> {
  const snapshot = await getTenantLifecycleSnapshot(input.tenantId, input.client);
  const allowed = isStatusAllowedOnSurface({
    status: snapshot.normalizedStatus,
    surface: input.surface,
    operation: input.operation,
  });

  if (!allowed) {
    throw new TenantLifecycleAccessError({
      status: snapshot.normalizedStatus,
      surface: input.surface,
      operation: input.operation,
    });
  }

  return snapshot;
}
