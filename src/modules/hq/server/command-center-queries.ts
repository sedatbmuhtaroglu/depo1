import type { SalesLeadSource, SalesLeadStatus } from "@prisma/client";
import { resolveTenantSetupProgress } from "@/core/tenancy/setup-progress";
import { prisma } from "@/lib/prisma";
import { getTurkeyDayRange } from "@/lib/turkey-time";
import { getHqSalesOverviewData } from "@/modules/hq/server/lead-queries";
import { getHqOverviewData } from "@/modules/hq/server/tenant-queries";

function sevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date;
}

function statusCount(
  counts: Record<SalesLeadStatus, number>,
  status: SalesLeadStatus,
): number {
  return counts[status] ?? 0;
}

export type HqCommandCenterData = {
  executive: {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    newLeadCount: number;
    conversionRatePercent: number;
    setupMissingTrialCount: number;
  };
  attention: {
    setupBlockerTenants: Array<{
      tenantId: number;
      name: string;
      slug: string;
      completionPercent: number;
      blocker: string;
    }>;
    newLeadsToday: Array<{
      leadId: number;
      businessName: string;
      contactName: string;
      createdAt: Date;
    }>;
    trialStartedNotGoLive: Array<{
      leadId: number;
      tenantId: number;
      businessName: string;
      tenantName: string;
      tenantSlug: string;
      completionPercent: number;
      blockers: string[];
      trialStartedAt: Date | null;
    }>;
    wonLostLast7Days: {
      wonCount: number;
      lostCount: number;
      recentMoves: Array<{
        leadId: number;
        businessName: string;
        status: "WON" | "LOST";
        movedAt: Date;
      }>;
    };
  };
  sales: {
    statusCounts: Record<SalesLeadStatus, number>;
    recentLeads: Array<{
      id: number;
      businessName: string;
      status: SalesLeadStatus;
      source: SalesLeadSource;
      createdAt: Date;
    }>;
  };
  setupHealth: {
    evaluatedTenantCount: number;
    blockerTenantCount: number;
    goLiveReadyCount: number;
    lowCompletionTenants: Array<{
      tenantId: number;
      name: string;
      slug: string;
      completionPercent: number;
      blockers: string[];
    }>;
    blockerTenants: Array<{
      tenantId: number;
      name: string;
      slug: string;
      blockers: string[];
      completionPercent: number;
    }>;
    readyTenants: Array<{
      tenantId: number;
      name: string;
      slug: string;
      completionPercent: number;
    }>;
  };
};

export async function getHqCommandCenterData(): Promise<HqCommandCenterData> {
  const todayRange = getTurkeyDayRange();
  const from7Days = sevenDaysAgo();

  const [
    tenantOverview,
    salesOverview,
    trialStartedTotal,
    onboardingCandidateRows,
    newLeadsToday,
    recentWonLostRows,
    trialStartedLeadRows,
  ] = await Promise.all([
    getHqOverviewData(),
    getHqSalesOverviewData(),
    prisma.salesLead.count({
      where: { trialStartedAt: { not: null } },
    }),
    prisma.tenant.findMany({
      where: {
        OR: [
          { setupCompleted: false },
          { setupProgress: { is: { currentStep: "TRIAL" } } },
          { setupProgress: { is: { currentStep: "PENDING_SETUP" } } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 18,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    }),
    prisma.salesLead.findMany({
      where: {
        createdAt: {
          gte: todayRange.startUtc,
          lt: todayRange.endUtc,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        createdAt: true,
      },
    }),
    prisma.salesLead.findMany({
      where: {
        OR: [{ wonAt: { gte: from7Days } }, { lostAt: { gte: from7Days } }],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 12,
      select: {
        id: true,
        businessName: true,
        wonAt: true,
        lostAt: true,
      },
    }),
    prisma.salesLead.findMany({
      where: {
        status: "TRIAL_STARTED",
        tenantId: { not: null },
      },
      orderBy: [{ trialStartedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        businessName: true,
        trialStartedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const setupSnapshots = await Promise.all(
    onboardingCandidateRows.map(async (tenant) => ({
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      setup: await resolveTenantSetupProgress(tenant.id),
    })),
  );

  const blockerTenants = setupSnapshots
    .filter((row) => row.setup.blockers.length > 0)
    .sort((a, b) => a.setup.completionPercent - b.setup.completionPercent);

  const lowCompletionTenants = setupSnapshots
    .filter((row) => row.setup.completionPercent < 65)
    .sort((a, b) => a.setup.completionPercent - b.setup.completionPercent);

  const readyTenants = setupSnapshots
    .filter((row) => row.setup.goLiveReady)
    .sort((a, b) => b.setup.completionPercent - a.setup.completionPercent);

  const trialStartedNotGoLive = await Promise.all(
    trialStartedLeadRows
      .filter((row) => row.tenant?.id != null)
      .map(async (row) => {
        const tenant = row.tenant!;
        const setup = await resolveTenantSetupProgress(tenant.id);
        return {
          leadId: row.id,
          tenantId: tenant.id,
          businessName: row.businessName,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          completionPercent: setup.completionPercent,
          blockers: setup.blockers,
          trialStartedAt: row.trialStartedAt,
          goLiveReady: setup.goLiveReady,
        };
      }),
  );

  const trialNotGoLiveFiltered = trialStartedNotGoLive
    .filter((row) => !row.goLiveReady)
    .map((row) => ({
      leadId: row.leadId,
      tenantId: row.tenantId,
      businessName: row.businessName,
      tenantName: row.tenantName,
      tenantSlug: row.tenantSlug,
      completionPercent: row.completionPercent,
      blockers: row.blockers,
      trialStartedAt: row.trialStartedAt,
    }))
    .slice(0, 8);

  const wonCount = recentWonLostRows.filter((row) => row.wonAt != null).length;
  const lostCount = recentWonLostRows.filter((row) => row.lostAt != null).length;

  const recentMoves = recentWonLostRows
    .map((row) => {
      if (row.wonAt && (!row.lostAt || row.wonAt >= row.lostAt)) {
        return {
          leadId: row.id,
          businessName: row.businessName,
          status: "WON" as const,
          movedAt: row.wonAt,
        };
      }
      if (row.lostAt) {
        return {
          leadId: row.id,
          businessName: row.businessName,
          status: "LOST" as const,
          movedAt: row.lostAt,
        };
      }
      return null;
    })
    .filter((item): item is { leadId: number; businessName: string; status: "WON" | "LOST"; movedAt: Date } => item !== null)
    .sort((a, b) => b.movedAt.getTime() - a.movedAt.getTime())
    .slice(0, 8);

  const wonTotal = statusCount(salesOverview.statusCounts, "WON");
  const conversionRatePercent =
    trialStartedTotal > 0 ? Math.round((wonTotal / trialStartedTotal) * 100) : 0;

  return {
    executive: {
      totalTenants: tenantOverview.totalTenants,
      activeTenants: tenantOverview.statusCounts.ACTIVE,
      trialTenants: tenantOverview.statusCounts.TRIAL,
      newLeadCount: salesOverview.statusCounts.NEW,
      conversionRatePercent,
      setupMissingTrialCount: salesOverview.trialAttentionCount,
    },
    attention: {
      setupBlockerTenants: blockerTenants.slice(0, 8).map((row) => ({
        tenantId: row.tenantId,
        name: row.name,
        slug: row.slug,
        completionPercent: row.setup.completionPercent,
        blocker: row.setup.blockers[0] ?? "Kurulum adimlari tamamlanmamis.",
      })),
      newLeadsToday: newLeadsToday.map((lead) => ({
        leadId: lead.id,
        businessName: lead.businessName,
        contactName: lead.contactName,
        createdAt: lead.createdAt,
      })),
      trialStartedNotGoLive: trialNotGoLiveFiltered,
      wonLostLast7Days: {
        wonCount,
        lostCount,
        recentMoves,
      },
    },
    sales: {
      statusCounts: salesOverview.statusCounts,
      recentLeads: salesOverview.recentLeads,
    },
    setupHealth: {
      evaluatedTenantCount: setupSnapshots.length,
      blockerTenantCount: blockerTenants.length,
      goLiveReadyCount: readyTenants.length,
      lowCompletionTenants: lowCompletionTenants.slice(0, 8).map((row) => ({
        tenantId: row.tenantId,
        name: row.name,
        slug: row.slug,
        completionPercent: row.setup.completionPercent,
        blockers: row.setup.blockers,
      })),
      blockerTenants: blockerTenants.slice(0, 8).map((row) => ({
        tenantId: row.tenantId,
        name: row.name,
        slug: row.slug,
        blockers: row.setup.blockers,
        completionPercent: row.setup.completionPercent,
      })),
      readyTenants: readyTenants.slice(0, 8).map((row) => ({
        tenantId: row.tenantId,
        name: row.name,
        slug: row.slug,
        completionPercent: row.setup.completionPercent,
      })),
    },
  };
}
