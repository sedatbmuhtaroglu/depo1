import { FeatureCode, PlanCode, Prisma } from "@prisma/client";
import { getTenantEntitlements } from "@/core/entitlements/engine";
import {
  resolveTenantLifecycleSnapshotFromRow,
  type TenantLifecycleStatus,
} from "@/core/tenancy/lifecycle-policy";
import { centsToDecimalString, decimalLikeToCents } from "@/lib/commercial-record";
import { prisma } from "@/lib/prisma";

type TenantStatusFilter =
  | "ALL"
  | "TRIAL"
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "PENDING_SETUP"
  | "PAST_DUE";

function normalizeSearch(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  return value.length > 0 ? value : null;
}

function normalizeStatusFilter(input: string | null | undefined): TenantStatusFilter {
  const value = (input ?? "").trim().toUpperCase();
  if (
    value === "TRIAL" ||
    value === "ACTIVE" ||
    value === "SUSPENDED" ||
    value === "EXPIRED" ||
    value === "PENDING_SETUP" ||
    value === "PAST_DUE"
  ) {
    return value;
  }
  return "ALL";
}

function normalizePlanCode(input: string | null | undefined): PlanCode | null {
  const value = (input ?? "").trim().toUpperCase();
  if (value === "MINI" || value === "RESTAURANT" || value === "CORPORATE") {
    return value;
  }
  return null;
}

function buildTenantStatusWhere(statusFilter: TenantStatusFilter): Prisma.TenantWhereInput {
  if (statusFilter === "ALL") return {};
  if (statusFilter === "ACTIVE") {
    return {
      status: "ACTIVE",
      setupCompleted: true,
    };
  }
  if (statusFilter === "TRIAL") {
    return {
      status: "ACTIVE",
      setupCompleted: false,
      setupProgress: {
        is: { currentStep: "TRIAL" },
      },
    };
  }
  if (statusFilter === "PENDING_SETUP") {
    return {
      status: "ACTIVE",
      setupCompleted: false,
      NOT: {
        setupProgress: {
          is: { currentStep: "TRIAL" },
        },
      },
    };
  }
  if (statusFilter === "PAST_DUE") {
    return { status: "EXPIRED" };
  }
  return { status: statusFilter as "SUSPENDED" | "EXPIRED" };
}

export type HqTenantListFilters = {
  search?: string | null;
  status?: string | null;
  planCode?: string | null;
};

export type HqTenantListItem = {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
  statusRaw: string;
  lifecycleStatus: TenantLifecycleStatus;
  planCode: string;
  planName: string;
  primaryDomain: string | null;
  restaurantsCount: number;
};

export async function listHqTenants(
  filters: HqTenantListFilters,
): Promise<HqTenantListItem[]> {
  const search = normalizeSearch(filters.search);
  const statusFilter = normalizeStatusFilter(filters.status);
  const planCode = normalizePlanCode(filters.planCode);

  const where: Prisma.TenantWhereInput = {
    ...buildTenantStatusWhere(statusFilter),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(planCode ? { plan: { code: planCode } } : {}),
  };

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      setupCompleted: true,
      setupProgress: { select: { currentStep: true } },
      createdAt: true,
      plan: {
        select: {
          code: true,
          name: true,
        },
      },
      domains: {
        where: { isPrimary: true },
        select: { domain: true },
        take: 1,
      },
      _count: {
        select: {
          restaurants: true,
        },
      },
    },
  });

  return tenants.map((tenant) => {
    const lifecycle = resolveTenantLifecycleSnapshotFromRow({
      tenantId: tenant.id,
      status: String(tenant.status),
      setupCompleted: tenant.setupCompleted,
      setupStep: tenant.setupProgress?.currentStep ?? null,
    });
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      statusRaw: String(tenant.status),
      lifecycleStatus: lifecycle.normalizedStatus,
      planCode: String(tenant.plan.code),
      planName: tenant.plan.name,
      primaryDomain: tenant.domains[0]?.domain ?? null,
      restaurantsCount: tenant._count.restaurants,
    };
  });
}

export type HqOverviewData = {
  totalTenants: number;
  needsAttentionCount: number;
  statusCounts: Record<TenantLifecycleStatus, number>;
  planCounts: Record<string, number>;
  recentTenants: HqTenantListItem[];
};

function emptyStatusCounts(): Record<TenantLifecycleStatus, number> {
  return {
    DRAFT: 0,
    PENDING_SETUP: 0,
    TRIAL: 0,
    ACTIVE: 0,
    PAST_DUE: 0,
    SUSPENDED: 0,
    CANCELED: 0,
  };
}

export async function getHqOverviewData(): Promise<HqOverviewData> {
  const tenants = await prisma.tenant.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      setupCompleted: true,
      setupProgress: { select: { currentStep: true } },
      createdAt: true,
      plan: {
        select: {
          code: true,
          name: true,
        },
      },
      domains: {
        where: { isPrimary: true },
        select: { domain: true },
        take: 1,
      },
      _count: {
        select: {
          restaurants: true,
        },
      },
    },
  });

  const statusCounts = emptyStatusCounts();
  const planCounts: Record<string, number> = {};

  const mapped = tenants.map((tenant) => {
    const lifecycle = resolveTenantLifecycleSnapshotFromRow({
      tenantId: tenant.id,
      status: String(tenant.status),
      setupCompleted: tenant.setupCompleted,
      setupStep: tenant.setupProgress?.currentStep ?? null,
    });
    statusCounts[lifecycle.normalizedStatus] += 1;
    const planCode = String(tenant.plan.code);
    planCounts[planCode] = (planCounts[planCode] ?? 0) + 1;

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      statusRaw: String(tenant.status),
      lifecycleStatus: lifecycle.normalizedStatus,
      planCode,
      planName: tenant.plan.name,
      primaryDomain: tenant.domains[0]?.domain ?? null,
      restaurantsCount: tenant._count.restaurants,
    } satisfies HqTenantListItem;
  });

  return {
    totalTenants: mapped.length,
    needsAttentionCount: statusCounts.SUSPENDED + statusCounts.PAST_DUE,
    statusCounts,
    planCounts,
    recentTenants: mapped.slice(0, 6),
  };
}

export type HqTenantDetail = {
  tenant: {
    id: number;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
    statusRaw: string;
    lifecycleStatus: TenantLifecycleStatus;
    setupCompleted: boolean;
    setupStep: string | null;
    planCode: string;
    planName: string;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
  };
  trialLead: null | {
    leadId: number;
    trialAdminUsername: string | null;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
  };
  trialManagerSetup: null | {
    username: string;
    displayName: string | null;
    mustSetPassword: boolean;
    passwordInitializedAt: Date | null;
    latestToken: null | {
      createdAt: Date;
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
    };
  };
  commercialSummary: null | {
    id: number;
    leadId: number;
    leadBusinessName: string;
    saleType: "DIRECT_PURCHASE" | "TRIAL_CONVERSION";
    planCode: string | null;
    packageName: string | null;
    currency: string;
    netSaleAmount: string;
    amountCollected: string;
    remainingBalance: string;
    paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    operationalStatus: "DRAFT" | "WON" | "CANCELLED";
    paymentMethodSummary: string | null;
    dueDate: Date | null;
    soldAt: Date;
    salespersonName: string | null;
    notes: string | null;
    payments: Array<{
      id: number;
      amount: string;
      currency: string;
      paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";
      paidAt: Date;
      note: string | null;
    }>;
  };
  domains: Array<{
    id: number;
    domain: string;
    isPrimary: boolean;
    isVerified: boolean;
    type: string;
  }>;
  usage: {
    users: number;
    tables: number;
    menus: number;
    restaurants: number;
    products: number;
  };
  entitlements: Awaited<ReturnType<typeof getTenantEntitlements>>;
  featureOverrides: Array<{
    featureCode: string;
    enabled: boolean;
  }>;
  limitOverrides: Array<{
    resource: string;
    limit: number | null;
  }>;
};

export async function getHqTenantDetail(tenantId: number): Promise<HqTenantDetail | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      setupCompleted: true,
      trialStartedAt: true,
      trialEndsAt: true,
      setupProgress: { select: { currentStep: true } },
      createdAt: true,
      updatedAt: true,
      plan: {
        select: {
          code: true,
          name: true,
        },
      },
      domains: {
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        select: {
          id: true,
          domain: true,
          isPrimary: true,
          isVerified: true,
          type: true,
        },
      },
      features: {
        include: {
          feature: { select: { code: true } },
        },
      },
      limitOverrides: {
        select: { resource: true, limit: true },
        orderBy: { resource: "asc" },
      },
      _count: {
        select: {
          restaurants: true,
          menus: true,
        },
      },
    },
  });

  if (!tenant) return null;

  const [users, tables, products, entitlements, trialLead, commercialRecord] = await Promise.all([
    prisma.tenantStaff.count({
      where: { tenantId: tenant.id, isActive: true },
    }),
    prisma.table.count({
      where: { restaurant: { tenantId: tenant.id } },
    }),
    prisma.product.count({
      where: { category: { restaurant: { tenantId: tenant.id } } },
    }),
    getTenantEntitlements(tenant.id),
    prisma.salesLead.findFirst({
      where: { tenantId: tenant.id },
      orderBy: [{ trialStartedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        trialAdminUsername: true,
        trialStartedAt: true,
        trialEndsAt: true,
      },
    }),
    prisma.commercialRecord.findFirst({
      where: {
        OR: [{ tenantId: tenant.id }, { lead: { tenantId: tenant.id } }],
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        leadId: true,
        saleType: true,
        planCode: true,
        packageName: true,
        currency: true,
        netSaleAmount: true,
        amountCollected: true,
        remainingBalance: true,
        paymentStatus: true,
        operationalStatus: true,
        paymentMethodSummary: true,
        dueDate: true,
        soldAt: true,
        salespersonName: true,
        notes: true,
        lead: {
          select: {
            businessName: true,
          },
        },
        payments: {
          orderBy: [{ paidAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            amount: true,
            currency: true,
            paymentMethod: true,
            paidAt: true,
            note: true,
          },
        },
      },
    }),
  ]);

  let trialManagerSetup: HqTenantDetail["trialManagerSetup"] = null;
  if (trialLead?.trialAdminUsername) {
    const manager = await prisma.tenantStaff.findFirst({
      where: {
        tenantId: tenant.id,
        username: trialLead.trialAdminUsername,
      },
      select: {
        username: true,
        displayName: true,
        mustSetPassword: true,
        passwordInitializedAt: true,
        setPasswordTokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            createdAt: true,
            expiresAt: true,
            consumedAt: true,
            revokedAt: true,
          },
        },
      },
    });

    if (manager) {
      trialManagerSetup = {
        username: manager.username,
        displayName: manager.displayName,
        mustSetPassword: manager.mustSetPassword,
        passwordInitializedAt: manager.passwordInitializedAt,
        latestToken: manager.setPasswordTokens[0] ?? null,
      };
    }
  }

  const lifecycle = resolveTenantLifecycleSnapshotFromRow({
    tenantId: tenant.id,
    status: String(tenant.status),
    setupCompleted: tenant.setupCompleted,
    setupStep: tenant.setupProgress?.currentStep ?? null,
  });

  const commercialSummary: HqTenantDetail["commercialSummary"] = commercialRecord
    ? {
        id: commercialRecord.id,
        leadId: commercialRecord.leadId,
        leadBusinessName: commercialRecord.lead.businessName,
        saleType: commercialRecord.saleType,
        planCode: commercialRecord.planCode ? String(commercialRecord.planCode) : null,
        packageName: commercialRecord.packageName,
        currency: commercialRecord.currency,
        netSaleAmount: centsToDecimalString(decimalLikeToCents(commercialRecord.netSaleAmount)),
        amountCollected: centsToDecimalString(decimalLikeToCents(commercialRecord.amountCollected)),
        remainingBalance: centsToDecimalString(
          decimalLikeToCents(commercialRecord.remainingBalance),
        ),
        paymentStatus: commercialRecord.paymentStatus,
        operationalStatus: commercialRecord.operationalStatus,
        paymentMethodSummary: commercialRecord.paymentMethodSummary,
        dueDate: commercialRecord.dueDate,
        soldAt: commercialRecord.soldAt,
        salespersonName: commercialRecord.salespersonName,
        notes: commercialRecord.notes,
        payments: commercialRecord.payments.map((payment) => ({
          id: payment.id,
          amount: centsToDecimalString(decimalLikeToCents(payment.amount)),
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          paidAt: payment.paidAt,
          note: payment.note,
        })),
      }
    : null;

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      statusRaw: String(tenant.status),
      lifecycleStatus: lifecycle.normalizedStatus,
      setupCompleted: tenant.setupCompleted,
      setupStep: tenant.setupProgress?.currentStep ?? null,
      planCode: String(tenant.plan.code),
      planName: tenant.plan.name,
      trialStartedAt: tenant.trialStartedAt,
      trialEndsAt: tenant.trialEndsAt,
    },
    trialLead: trialLead
      ? {
          leadId: trialLead.id,
          trialAdminUsername: trialLead.trialAdminUsername,
          trialStartedAt: trialLead.trialStartedAt,
          trialEndsAt: trialLead.trialEndsAt,
        }
      : null,
    trialManagerSetup,
    commercialSummary,
    domains: tenant.domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      isVerified: domain.isVerified,
      type: String(domain.type),
    })),
    usage: {
      users,
      tables,
      menus: tenant._count.menus,
      restaurants: tenant._count.restaurants,
      products,
    },
    entitlements,
    featureOverrides: tenant.features.map((row) => ({
      featureCode: String(row.feature.code),
      enabled: row.enabled,
    })),
    limitOverrides: tenant.limitOverrides.map((row) => ({
      resource: String(row.resource),
      limit: row.limit,
    })),
  };
}

export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: { id: true, code: true, name: true },
  });
  return plans.map((plan) => ({
    id: plan.id,
    code: String(plan.code),
    name: plan.name,
  }));
}

export async function listManageableFeatures() {
  const rows = await prisma.feature.findMany({
    orderBy: { id: "asc" },
    select: { code: true, name: true, description: true },
  });
  const mapped = rows.map((row) => ({
    code: String(row.code),
    name: row.name,
    description: row.description,
  }));
  const existing = new Set(mapped.map((row) => row.code));
  for (const code of Object.values(FeatureCode)) {
    if (!existing.has(code)) {
      mapped.push({
        code,
        name: code,
        description: null,
      });
    }
  }
  mapped.sort((a, b) => a.code.localeCompare(b.code));
  return mapped;
}
