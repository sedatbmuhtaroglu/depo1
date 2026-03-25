import type { ContentStatus } from "@prisma/client";
import { sanitizeRichTextHtml, stripHtml } from "@/modules/marketing/server/rich-text";
import { normalizeSlugInput } from "@/modules/content/shared/slug";
import {
  evaluateSeoCompleteness,
  type SeoCompletenessReport,
  type SeoCompletenessStatus,
} from "@/modules/content/shared/seo-score";

export const CONTENT_STATUSES: ContentStatus[] = ["DRAFT", "PUBLISHED"];

export function parseContentStatus(input: string | null | undefined): ContentStatus {
  const raw = (input ?? "").trim().toUpperCase();
  if (raw === "PUBLISHED") return "PUBLISHED";
  return "DRAFT";
}

export function normalizeText(value: FormDataEntryValue | null, maxLength: number): string {
  return (value?.toString() ?? "").trim().slice(0, maxLength);
}

export function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number): string | null {
  const normalized = normalizeText(value, maxLength);
  return normalized.length > 0 ? normalized : null;
}

export function normalizeOptionalUrl(value: FormDataEntryValue | null, maxLength = 320): string | null {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) return null;
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("/")
  ) {
    return normalized;
  }
  return null;
}

export function normalizeOptionalBoolean(value: FormDataEntryValue | null): boolean {
  const raw = (value?.toString() ?? "").trim().toLowerCase();
  return raw === "true" || raw === "on" || raw === "1" || raw === "yes";
}

export function normalizeRichHtmlInput(value: FormDataEntryValue | null, maxLength = 40_000): string {
  return sanitizeRichTextHtml(value?.toString() ?? "", maxLength);
}

export function normalizeSlugValue(input: FormDataEntryValue | null, title: string, fallbackPrefix: string): string {
  const candidate = (input?.toString() ?? "").trim();
  if (candidate.length > 0) {
    return normalizeSlugInput(candidate, fallbackPrefix);
  }
  return normalizeSlugInput(title, fallbackPrefix);
}

export function computeReadingTimeMinutes(contentHtml: string): number {
  const plain = stripHtml(contentHtml);
  if (!plain) return 1;
  const words = plain.split(/\s+/g).filter((word) => word.length > 0).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function parseTagsInput(value: FormDataEntryValue | null): string[] {
  const raw = (value?.toString() ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .slice(0, 20);
}

export function buildSeoCompleteness(input: {
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
}): {
  score: number;
  isComplete: boolean;
} {
  const evaluated = evaluateSeoCompleteness({
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    ogImage: input.ogImage,
  });

  return {
    score: evaluated.score,
    isComplete: evaluated.score >= 80,
  };
}
export { evaluateSeoCompleteness };
export type { SeoCompletenessReport, SeoCompletenessStatus };
