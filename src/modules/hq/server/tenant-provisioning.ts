import { PlanCode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveProvisioningStatus,
  type InitialProvisioningStatus,
} from "@/modules/hq/server/tenant-status";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export class TenantProvisioningError extends Error {
  readonly code:
    | "INVALID_TENANT_NAME"
    | "INVALID_TENANT_SLUG"
    | "INVALID_PLAN"
    | "PLAN_INACTIVE"
    | "SLUG_IN_USE";

  constructor(
    code:
      | "INVALID_TENANT_NAME"
      | "INVALID_TENANT_SLUG"
      | "INVALID_PLAN"
      | "PLAN_INACTIVE"
      | "SLUG_IN_USE",
    message: string,
  ) {
    super(message);
    this.name = "TenantProvisioningError";
    this.code = code;
  }
}

export function normalizeTenantSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!slug) return null;
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return null;
  return slug;
}

function resolveEnvBaseDomain(): string | null {
  const raw = process.env.APP_BASE_DOMAIN ?? "";
  const firstToken = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  if (!firstToken) return null;
  return firstToken;
}

export function parsePlanCode(value: string): PlanCode | null {
  const raw = value.trim().toUpperCase();
  if (raw === "MINI" || raw === "RESTAURANT" || raw === "CORPORATE") {
    return raw;
  }
  return null;
}

export function normalizeInitialStatus(value: string | null): InitialProvisioningStatus | null {
  if (value === "TRIAL" || value === "ACTIVE" || value === "PENDING_SETUP") {
    return value;
  }
  return null;
}

function normalizeRestaurantSlugBase(slug: string): string {
  return `${slug}-main`;
}

function slugifyText(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "tenant";
}

async function resolveUniqueRestaurantSlug(
  base: string,
  client: PrismaClientLike,
): Promise<string> {
  let candidate = base;
  let seq = 1;
  while (seq <= 20) {
    const existing = await client.restaurant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    seq += 1;
    candidate = `${base}-${seq}`;
  }
  return `${base}-${Date.now()}`;
}

export async function resolveAvailableTenantSlug(
  base: string,
  client: PrismaClientLike = prisma,
): Promise<string> {
  const normalizedBase = normalizeTenantSlug(slugifyText(base));
  const safeBase = normalizedBase ?? "tenant";

  let candidate = safeBase;
  let seq = 1;
  while (seq <= 40) {
    const existing = await client.tenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    seq += 1;
    candidate = `${safeBase}-${seq}`;
  }
  return `${safeBase}-${Date.now()}`;
}

type TenantProvisioningInput = {
  name: string;
  slug: string;
  planCode: PlanCode;
  initialStatus: InitialProvisioningStatus;
  restaurantName?: string | null;
  primaryDomain?: string | null;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
};

async function assertProvisioningInput(
  input: TenantProvisioningInput,
  client: PrismaClientLike,
) {
  const name = input.name.trim();
  if (!name) {
    throw new TenantProvisioningError("INVALID_TENANT_NAME", "Tenant adi zorunlu.");
  }

  const slug = normalizeTenantSlug(input.slug);
  if (!slug) {
    throw new TenantProvisioningError("INVALID_TENANT_SLUG", "Gecerli bir slug girin.");
  }

  const plan = await client.plan.findUnique({
    where: { code: input.planCode },
    select: { id: true, code: true, isActive: true },
  });
  if (!plan) {
    throw new TenantProvisioningError("INVALID_PLAN", "Plan bulunamadi.");
  }
  if (!plan.isActive) {
    throw new TenantProvisioningError("PLAN_INACTIVE", "Plan pasif durumda.");
  }

  const existingTenant = await client.tenant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existingTenant) {
    throw new TenantProvisioningError("SLUG_IN_USE", "Bu slug zaten kullanimda.");
  }

  return { normalizedName: name, normalizedSlug: slug, planId: plan.id, planCode: plan.code };
}

export async function provisionTenantTx(
  tx: Prisma.TransactionClient,
  input: TenantProvisioningInput,
) {
  const validated = await assertProvisioningInput(input, tx);
  const domainInput = (input.primaryDomain ?? "").trim().toLowerCase();
  const resolvedStatus = resolveProvisioningStatus(input.initialStatus);
  const envBaseDomain = resolveEnvBaseDomain();
  const primaryDomain =
    domainInput.length > 0
      ? domainInput
      : `${validated.normalizedSlug}.${envBaseDomain ?? "localhost"}`;

  const tenant = await tx.tenant.create({
    data: {
      name: validated.normalizedName,
      slug: validated.normalizedSlug,
      planId: validated.planId,
      status: resolvedStatus.status,
      setupCompleted: resolvedStatus.setupCompleted,
      trialStartedAt: input.trialStartedAt ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
    },
    select: { id: true, name: true, slug: true },
  });

  await tx.setupProgress.upsert({
    where: { tenantId: tenant.id },
    update: {
      currentStep: resolvedStatus.setupStep,
      businessInfoCompleted: resolvedStatus.setupCompleted,
      branchSetupCompleted: false,
      tablesSetupCompleted: false,
      menuSetupCompleted: false,
      domainSetupCompleted: false,
      completedAt: resolvedStatus.setupCompleted ? new Date() : null,
    },
    create: {
      tenantId: tenant.id,
      currentStep: resolvedStatus.setupStep,
      businessInfoCompleted: resolvedStatus.setupCompleted,
      branchSetupCompleted: false,
      tablesSetupCompleted: false,
      menuSetupCompleted: false,
      domainSetupCompleted: false,
      completedAt: resolvedStatus.setupCompleted ? new Date() : null,
    },
  });

  await tx.tenantDomain.create({
    data: {
      tenantId: tenant.id,
      domain: primaryDomain,
      type: "SUBDOMAIN",
      isPrimary: true,
      isVerified: false,
    },
  });

  const restaurantName = (input.restaurantName ?? "").trim();
  if (restaurantName) {
    const restaurantSlug = await resolveUniqueRestaurantSlug(
      normalizeRestaurantSlugBase(validated.normalizedSlug),
      tx,
    );
    await tx.restaurant.create({
      data: {
        tenantId: tenant.id,
        name: restaurantName,
        slug: restaurantSlug,
        themeColor: "primary",
      },
    });
  }

  return {
    tenant,
    planCode: validated.planCode,
    initialStatus: input.initialStatus,
  };
}

export async function provisionTenant(input: TenantProvisioningInput) {
  return prisma.$transaction((tx) => provisionTenantTx(tx, input));
}
