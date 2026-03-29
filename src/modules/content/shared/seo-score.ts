export type SeoCompletenessStatus = "strong" | "medium" | "weak";

export type SeoCompletenessReport = {
  score: number;
  isComplete: boolean;
  status: SeoCompletenessStatus;
  missing: string[];
  warnings: string[];
  successes: string[];
};

export type EvaluateSeoCompletenessInput = {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  slug?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
  featuredImageUrl?: string | null;
};

function hasValue(value: string | null | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

function normalizeLength(value: string | null | undefined): number {
  return (value ?? "").trim().length;
}

export function evaluateSeoCompleteness(input: EvaluateSeoCompletenessInput): SeoCompletenessReport {
  let score = 0;
  const missing: string[] = [];
  const warnings: string[] = [];
  const successes: string[] = [];

  const titleLength = normalizeLength(input.seoTitle);
  if (titleLength > 0) {
    score += 14;
    successes.push("SEO title tanimli.");
    if (titleLength < 30 || titleLength > 60) {
      warnings.push("SEO title uzunlugu onerilen 30-60 araliginda degil.");
    } else {
      score += 6;
      successes.push("SEO title uzunlugu uygun.");
    }
  } else {
    missing.push("SEO title eksik.");
  }

  const descriptionLength = normalizeLength(input.metaDescription);
  if (descriptionLength > 0) {
    score += 14;
    successes.push("Meta description tanimli.");
    if (descriptionLength < 70 || descriptionLength > 160) {
      warnings.push("Meta description uzunlugu onerilen 70-160 araliginda degil.");
    } else {
      score += 6;
      successes.push("Meta description uzunlugu uygun.");
    }
  } else {
    missing.push("Meta description eksik.");
  }

  if (hasValue(input.canonicalUrl)) {
    score += 10;
    successes.push("Canonical URL tanimli.");
  } else {
    missing.push("Canonical URL eksik.");
  }

  if (hasValue(input.ogTitle)) {
    score += 8;
    successes.push("OG title tanimli.");
  } else {
    missing.push("OG title eksik.");
  }

  if (hasValue(input.ogDescription)) {
    score += 8;
    successes.push("OG description tanimli.");
  } else {
    missing.push("OG description eksik.");
  }

  if (hasValue(input.ogImage)) {
    score += 10;
    successes.push("OG image tanimli.");
  } else {
    missing.push("OG image eksik.");
  }

  if (hasValue(input.slug)) {
    const slug = (input.slug ?? "").trim();
    if (slug.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      score += 8;
      successes.push("Slug formati uygun.");
    } else {
      warnings.push("Slug kisa veya SEO dostu formata uygun degil.");
    }
  }

  if (typeof input.robotsIndex === "boolean" && typeof input.robotsFollow === "boolean") {
    score += 6;
    successes.push("Robots ayari net.");
  } else {
    warnings.push("Robots ayarlari net degil.");
  }

  if (hasValue(input.featuredImageUrl)) {
    score += 6;
    successes.push("Kapak/featured image tanimli.");
  }

  score = Math.max(0, Math.min(100, score));
  const status: SeoCompletenessStatus = score >= 80 ? "strong" : score >= 50 ? "medium" : "weak";

  return {
    score,
    isComplete: score >= 80 && missing.length === 0,
    status,
    missing,
    warnings,
    successes,
  };
}
