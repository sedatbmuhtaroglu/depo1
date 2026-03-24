import type { Prisma, SalesLeadSource, SalesLeadStatus } from "@prisma/client";
import { resolveTenantLifecycleSnapshotFromRow } from "@/core/tenancy/lifecycle-policy";
import { resolveTenantSetupProgress } from "@/core/tenancy/setup-progress";
import { centsToDecimalString, decimalLikeToCents } from "@/lib/commercial-record";
import { prisma } from "@/lib/prisma";
import {
  parseSalesLeadSource,
  parseSalesLeadStatus,
  SALES_LEAD_SOURCES,
  SALES_LEAD_STATUSES,
} from "@/modules/hq/server/lead-status";

type LeadStatusFilter = SalesLeadStatus | "ALL";
type LeadSourceFilter = SalesLeadSource | "ALL";

function normalizeSearch(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  return value.length > 0 ? value : null;
}

function normalizeLeadStatusFilter(input: string | null | undefined): LeadStatusFilter {
  const parsed = parseSalesLeadStatus(input);
  return parsed ?? "ALL";
}

function normalizeLeadSourceFilter(input: string | null | undefined): LeadSourceFilter {
  const parsed = parseSalesLeadSource(input);
  return parsed ?? "ALL";
}

export type HqLeadListFilters = {
  search?: string | null;
  status?: string | null;
  source?: string | null;
};

export type HqLeadListItem = {
  id: number;
  businessName: string;
  contactName: string;
  phone: string | null;
  email: string | null;
  source: SalesLeadSource;
  status: SalesLeadStatus;
  createdAt: Date;
  tenant: null | {
    id: number;
    name: string;
    slug: string;
    lifecycleStatus: string;
    setupCompleted: boolean;
  };
};

export async function listHqLeads(filters: HqLeadListFilters): Promise<HqLeadListItem[]> {
  const search = normalizeSearch(filters.search);
  const statusFilter = normalizeLeadStatusFilter(filters.status);
  const sourceFilter = normalizeLeadSourceFilter(filters.source);

  const where: Prisma.SalesLeadWhereInput = {
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(sourceFilter !== "ALL" ? { source: sourceFilter } : {}),
    ...(search
      ? {
          OR: [
            { businessName: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const leads = await prisma.salesLead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      email: true,
      source: true,
      status: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          setupCompleted: true,
          setupProgress: { select: { currentStep: true } },
        },
      },
    },
  });

  return leads.map((lead) => {
    if (!lead.tenant) {
      return {
        id: lead.id,
        businessName: lead.businessName,
        contactName: lead.contactName,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        status: lead.status,
        createdAt: lead.createdAt,
        tenant: null,
      };
    }

    const lifecycle = resolveTenantLifecycleSnapshotFromRow({
      tenantId: lead.tenant.id,
      status: String(lead.tenant.status),
      setupCompleted: lead.tenant.setupCompleted,
      setupStep: lead.tenant.setupProgress?.currentStep ?? null,
    });

    return {
      id: lead.id,
      businessName: lead.businessName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      status: lead.status,
      createdAt: lead.createdAt,
      tenant: {
        id: lead.tenant.id,
        name: lead.tenant.name,
        slug: lead.tenant.slug,
        lifecycleStatus: lifecycle.normalizedStatus,
        setupCompleted: lead.tenant.setupCompleted,
      },
    };
  });
}

export type HqLeadDetail = {
  lead: {
    id: number;
    businessName: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    notes: string | null;
    source: SalesLeadSource;
    status: SalesLeadStatus;
    assignedTo: string | null;
    lostReason: string | null;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    trialAdminUsername: string | null;
    wonAt: Date | null;
    lostAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  tenant: null | {
    id: number;
    name: string;
    slug: string;
    planCode: string;
    planName: string;
    lifecycleStatus: string;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
  };
  trialManagerSetup: null | {
    username: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    mustSetPassword: boolean;
    passwordInitializedAt: Date | null;
    latestToken: null | {
      createdAt: Date;
      expiresAt: Date;
      consumedAt: Date | null;
      revokedAt: Date | null;
    };
  };
  setupSummary: null | Awaited<ReturnType<typeof resolveTenantSetupProgress>>;
  commercialRecord: null | {
    id: number;
    leadId: number;
    tenantId: number | null;
    saleType: "DIRECT_PURCHASE" | "TRIAL_CONVERSION";
    planCode: string | null;
    packageName: string | null;
    currency: string;
    listPrice: string;
    discountAmount: string;
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
    updatedAt: Date;
    payments: Array<{
      id: number;
      amount: string;
      currency: string;
      paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";
      paidAt: Date;
      note: string | null;
      createdAt: Date;
    }>;
  };
  events: Array<{
    id: number;
    actionType: string;
    description: string | null;
    actorUsername: string;
    createdAt: Date;
  }>;
};

export async function getHqLeadDetail(leadId: number): Promise<HqLeadDetail | null> {
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      email: true,
      city: true,
      notes: true,
      source: true,
      status: true,
      assignedTo: true,
      lostReason: true,
      trialStartedAt: true,
      trialEndsAt: true,
      trialAdminUsername: true,
      wonAt: true,
      lostAt: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          setupCompleted: true,
          setupProgress: { select: { currentStep: true } },
          plan: {
            select: {
              code: true,
              name: true,
            },
          },
          trialStartedAt: true,
          trialEndsAt: true,
        },
      },
      commercialRecord: {
        select: {
          id: true,
          leadId: true,
          tenantId: true,
          saleType: true,
          planCode: true,
          packageName: true,
          currency: true,
          listPrice: true,
          discountAmount: true,
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
          updatedAt: true,
          payments: {
            orderBy: [{ paidAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              amount: true,
              currency: true,
              paymentMethod: true,
              paidAt: true,
              note: true,
              createdAt: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          actionType: true,
          description: true,
          actorUsername: true,
          createdAt: true,
        },
      },
    },
  });

  if (!lead) return null;

  let setupSummary: HqLeadDetail["setupSummary"] = null;
  let tenantSummary: HqLeadDetail["tenant"] = null;
  let trialManagerSetup: HqLeadDetail["trialManagerSetup"] = null;
  if (lead.tenant) {
    const lifecycle = resolveTenantLifecycleSnapshotFromRow({
      tenantId: lead.tenant.id,
      status: String(lead.tenant.status),
      setupCompleted: lead.tenant.setupCompleted,
      setupStep: lead.tenant.setupProgress?.currentStep ?? null,
    });
    setupSummary = await resolveTenantSetupProgress(lead.tenant.id);
    tenantSummary = {
      id: lead.tenant.id,
      name: lead.tenant.name,
      slug: lead.tenant.slug,
      planCode: String(lead.tenant.plan.code),
      planName: lead.tenant.plan.name,
      lifecycleStatus: lifecycle.normalizedStatus,
      trialStartedAt: lead.tenant.trialStartedAt,
      trialEndsAt: lead.tenant.trialEndsAt,
    };

    if (lead.trialAdminUsername) {
      const trialManager = await prisma.tenantStaff.findFirst({
        where: {
          tenantId: lead.tenant.id,
          username: lead.trialAdminUsername,
        },
        select: {
          username: true,
          displayName: true,
          email: true,
          phone: true,
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

      if (trialManager) {
        trialManagerSetup = {
          username: trialManager.username,
          displayName: trialManager.displayName,
          email: trialManager.email,
          phone: trialManager.phone,
          mustSetPassword: trialManager.mustSetPassword,
          passwordInitializedAt: trialManager.passwordInitializedAt,
          latestToken: trialManager.setPasswordTokens[0] ?? null,
        };
      }
    }
  }

  const commercialRecord: HqLeadDetail["commercialRecord"] = lead.commercialRecord
    ? {
        id: lead.commercialRecord.id,
        leadId: lead.commercialRecord.leadId,
        tenantId: lead.commercialRecord.tenantId,
        saleType: lead.commercialRecord.saleType,
        planCode: lead.commercialRecord.planCode ? String(lead.commercialRecord.planCode) : null,
        packageName: lead.commercialRecord.packageName,
        currency: lead.commercialRecord.currency,
        listPrice: centsToDecimalString(decimalLikeToCents(lead.commercialRecord.listPrice)),
        discountAmount: centsToDecimalString(
          decimalLikeToCents(lead.commercialRecord.discountAmount),
        ),
        netSaleAmount: centsToDecimalString(decimalLikeToCents(lead.commercialRecord.netSaleAmount)),
        amountCollected: centsToDecimalString(
          decimalLikeToCents(lead.commercialRecord.amountCollected),
        ),
        remainingBalance: centsToDecimalString(
          decimalLikeToCents(lead.commercialRecord.remainingBalance),
        ),
        paymentStatus: lead.commercialRecord.paymentStatus,
        operationalStatus: lead.commercialRecord.operationalStatus,
        paymentMethodSummary: lead.commercialRecord.paymentMethodSummary,
        dueDate: lead.commercialRecord.dueDate,
        soldAt: lead.commercialRecord.soldAt,
        salespersonName: lead.commercialRecord.salespersonName,
        notes: lead.commercialRecord.notes,
        updatedAt: lead.commercialRecord.updatedAt,
        payments: lead.commercialRecord.payments.map((payment) => ({
          id: payment.id,
          amount: centsToDecimalString(decimalLikeToCents(payment.amount)),
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          paidAt: payment.paidAt,
          note: payment.note,
          createdAt: payment.createdAt,
        })),
      }
    : null;

  return {
    lead: {
      id: lead.id,
      businessName: lead.businessName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      notes: lead.notes,
      source: lead.source,
      status: lead.status,
      assignedTo: lead.assignedTo,
      lostReason: lead.lostReason,
      trialStartedAt: lead.trialStartedAt,
      trialEndsAt: lead.trialEndsAt,
      trialAdminUsername: lead.trialAdminUsername,
      wonAt: lead.wonAt,
      lostAt: lead.lostAt,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    },
    tenant: tenantSummary,
    trialManagerSetup,
    setupSummary,
    commercialRecord,
    events: lead.events,
  };
}

export type HqSalesOverviewData = {
  totalLeads: number;
  trialLeads: number;
  wonLeads: number;
  trialAttentionCount: number;
  statusCounts: Record<SalesLeadStatus, number>;
  recentLeads: Array<{
    id: number;
    businessName: string;
    status: SalesLeadStatus;
    source: SalesLeadSource;
    createdAt: Date;
  }>;
};

function emptyLeadStatusCounts(): Record<SalesLeadStatus, number> {
  return {
    NEW: 0,
    CONTACTED: 0,
    DEMO_SCHEDULED: 0,
    TRIAL_STARTED: 0,
    WON: 0,
    LOST: 0,
  };
}

export async function getHqSalesOverviewData(): Promise<HqSalesOverviewData> {
  const [leads, trialAttentionCount] = await Promise.all([
    prisma.salesLead.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        businessName: true,
        status: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.salesLead.count({
      where: {
        status: "TRIAL_STARTED",
        OR: [{ tenantId: null }, { tenant: { setupCompleted: false } }],
      },
    }),
  ]);

  const statusCounts = emptyLeadStatusCounts();
  for (const lead of leads) {
    statusCounts[lead.status] += 1;
  }

  return {
    totalLeads: leads.length,
    trialLeads: statusCounts.TRIAL_STARTED,
    wonLeads: statusCounts.WON,
    trialAttentionCount,
    statusCounts,
    recentLeads: leads.slice(0, 6),
  };
}

export function getSalesLeadFilterOptions() {
  return {
    statuses: SALES_LEAD_STATUSES,
    sources: SALES_LEAD_SOURCES,
  };
}
