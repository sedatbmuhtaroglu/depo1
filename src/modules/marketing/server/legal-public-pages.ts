import { landingBrand } from "@/content/landing";
import { DEFAULT_LEGAL_LAST_UPDATED_LABEL, buildDefaultLegalPublicPages } from "@/content/legal-default-html";
import { prisma } from "@/lib/prisma";
import {
  hasStoredLegalOverrides,
  mergeLegalPublicPagesWithDefaults,
  parseLegalPublicPagesJson,
  type LegalPageKey,
  type LegalPublicPagesV1,
} from "@/modules/marketing/legal-public-pages";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";

/** Okuma yolunda tekrar sanitize edilmez; HQ kayit sirasinda zaten sanitizeRichTextHtml uygulanir. */

function formatTrDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(value);
}

export async function getLegalPublicPagesMerged(): Promise<LegalPublicPagesV1> {
  const siteId = await ensureMainMarketingSiteId();
  const defaults = buildDefaultLegalPublicPages(landingBrand.name);
  const row = await prisma.marketingSiteConfig.findUnique({
    where: { id: siteId },
    select: { legalPublicPages: true },
  });
  const parsed = parseLegalPublicPagesJson(row?.legalPublicPages ?? null);
  return mergeLegalPublicPagesWithDefaults(parsed, defaults);
}

export async function resolveLegalPageBody(
  key: LegalPageKey,
): Promise<{ html: string; lastUpdatedLabel: string }> {
  const siteId = await ensureMainMarketingSiteId();
  const defaults = buildDefaultLegalPublicPages(landingBrand.name);
  const row = await prisma.marketingSiteConfig.findUnique({
    where: { id: siteId },
    select: { legalPublicPages: true, updatedAt: true },
  });
  const parsed = parseLegalPublicPagesJson(row?.legalPublicPages ?? null);
  const merged = mergeLegalPublicPagesWithDefaults(parsed, defaults);
  const html = merged[key];
  const lastUpdatedLabel = hasStoredLegalOverrides(parsed)
    ? formatTrDate(row!.updatedAt)
    : DEFAULT_LEGAL_LAST_UPDATED_LABEL;
  return { html, lastUpdatedLabel };
}
