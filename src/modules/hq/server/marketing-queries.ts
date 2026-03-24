import type { MarketingSubmissionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

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
  source: "LANDING_HOMEPAGE" | "LANDING_CTA" | "LANDING_FOOTER";
  contactName: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
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

  const rows = await prisma.marketingFormSubmission.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      status: true,
      source: true,
      contactName: true,
      businessName: true,
      phone: true,
      email: true,
      city: true,
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

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    status: row.status,
    source: row.source,
    contactName: row.contactName,
    businessName: row.businessName,
    phone: row.phone,
    email: row.email,
    city: row.city,
    leadId: row.leadId,
    leadSource: row.lead?.source ?? null,
    failureReason: row.failureReason,
  }));
}

export async function getHqMarketingOverview() {
  const [site, totalSubmissions, createdLeads, failedLeadCreates, todaySubmissions] =
    await Promise.all([
      getMarketingSiteConfigForHq(),
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
