import type { MarketingSubmissionSource, MarketingSubmissionStatus, Prisma } from "@prisma/client";
import {
  displayContactNameForList,
  displayEmailForList,
  displayPhoneForList,
} from "@/lib/pii/pii-read";
import { buildMarketingSubmissionSearchOr } from "@/lib/pii/pii-search";
import { prisma } from "@/lib/prisma";
import { getMainMarketingSiteSummaryForHq } from "@/modules/marketing/server/landing-content";

type SubmissionStatusFilter = MarketingSubmissionStatus | "ALL";

function normalizeSearch(input: string | null | undefined): string | null {
  const normalized = (input ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStatus(input: string | null | undefined): SubmissionStatusFilter {
  const raw = (input ?? "").trim().toUpperCase();
  if (
    raw === "RECEIVED" ||
    raw === "LEAD_CREATED" ||
    raw === "LEAD_CREATE_FAILED" ||
    raw === "SPAM_REJECTED"
  ) {
    return raw;
  }
  return "ALL";
}

export type MarketingSubmissionListFilters = {
  q?: string | null;
  status?: string | null;
};

export type MarketingSubmissionListItem = {
  id: number;
  createdAt: Date;
  status: MarketingSubmissionStatus;
  source: MarketingSubmissionSource;
  contactName: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
  leadId: number | null;
  leadSource: string | null;
  failureReason: string | null;
};

export async function listMarketingSubmissions(
  filters: MarketingSubmissionListFilters,
): Promise<MarketingSubmissionListItem[]> {
  const search = normalizeSearch(filters.q);
  const status = normalizeStatus(filters.status);

  const where: Prisma.MarketingFormSubmissionWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(search ? { OR: buildMarketingSubmissionSearchOr(search) } : {}),
  };

  const rows = await prisma.marketingFormSubmission.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      status: true,
      source: true,
      contactName: true,
      contactNameEncrypted: true,
      contactNameMasked: true,
      businessName: true,
      phone: true,
      phoneEncrypted: true,
      phoneLast4: true,
      email: true,
      emailEncrypted: true,
      emailMasked: true,
      city: true,
      message: true,
      leadId: true,
      failureReason: true,
      lead: {
        select: {
          source: true,
        },
      },
    },
    take: 300,
  });

  return rows.map((row) => {
    const pii = {
      email: row.email,
      emailEncrypted: row.emailEncrypted,
      emailMasked: row.emailMasked,
      phone: row.phone,
      phoneEncrypted: row.phoneEncrypted,
      phoneLast4: row.phoneLast4,
      contactName: row.contactName,
      contactNameEncrypted: row.contactNameEncrypted,
      contactNameMasked: row.contactNameMasked,
    };
    return {
      id: row.id,
      createdAt: row.createdAt,
      status: row.status,
      source: row.source,
      contactName: displayContactNameForList(pii),
      businessName: row.businessName,
      phone: displayPhoneForList(pii),
      email: displayEmailForList(pii),
      city: row.city,
      message: row.message,
      leadId: row.leadId,
      leadSource: row.lead?.source ?? null,
      failureReason: row.failureReason,
    };
  });
}

export async function getHqMarketingOverview() {
  const [site, totalSubmissions, createdLeads, failedLeadCreates, todaySubmissions] =
    await Promise.all([
      getMainMarketingSiteSummaryForHq(),
      prisma.marketingFormSubmission.count(),
      prisma.marketingFormSubmission.count({
        where: { status: "LEAD_CREATED" },
      }),
      prisma.marketingFormSubmission.count({
        where: { status: "LEAD_CREATE_FAILED" },
      }),
      prisma.marketingFormSubmission.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  return {
    site,
    stats: {
      totalSubmissions,
      createdLeads,
      failedLeadCreates,
      todaySubmissions,
    },
  };
}
