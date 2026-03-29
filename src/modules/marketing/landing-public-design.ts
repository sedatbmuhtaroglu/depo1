import {
  landingHero,
  landingNav,
  landingBrand,
  landingPricing,
} from "@/content/landing";

export const LANDING_PUBLIC_DESIGN_VERSION = 1 as const;

export type LandingNavLinkType = "internal" | "external";

export type LandingPublicNavItem = {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
  linkType: LandingNavLinkType;
};

export type LandingPublicCta = {
  label: string;
  href: string;
  enabled: boolean;
};

export type LandingPublicColors = {
  primaryBg: string;
  primaryFg: string;
  primaryHoverBg: string;
  outlineFg: string;
  outlineBorder: string;
  outlineHoverBg: string;
};

export type LandingPublicGeneral = {
  brandName: string;
  brandTagline: string;
  showTaglineInHeader: boolean;
};

export type LandingPublicPricingPlan = {
  id: string;
  name: string;
  /** Aylık faturalandırma fiyat satırı (örn. "₺1.990" veya "Teklif") */
  priceMonthly: string;
  /** Aylık dönem etiketi (örn. "/ ay" veya "işletmeye göre") */
  periodMonthly: string;
  /** Yıllık faturalandırma fiyat satırı */
  priceYearly: string;
  /** Yıllık dönem etiketi (örn. "/ yıl") */
  periodYearly: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted: boolean;
  /** Örn. "Önerilen"; vurgulu kartta üst rozet olarak gösterilir */
  badge: string;
};

export type LandingPublicPricing = {
  /** Bölüm anchor (#fiyat) */
  sectionId: string;
  eyebrow: string;
  title: string;
  description: string;
  microTrust: string[];
  /** Aylık / yıllık seçiciyi göster */
  billingToggleEnabled: boolean;
  /** Seçici: aylık seçeneği etiketi */
  billingMonthlyLabel: string;
  /** Seçici: yıllık seçeneği etiketi */
  billingYearlyLabel: string;
  /** Yıllık sekmesinin yanında küçük ipucu (örn. "2 ay bedava") — boşsa gösterilmez */
  billingYearlyHint: string;
  plans: LandingPublicPricingPlan[];
};

export type LandingPublicDesignV1 = {
  version: typeof LANDING_PUBLIC_DESIGN_VERSION;
  colors: LandingPublicColors;
  nav: LandingPublicNavItem[];
  headerBarCta: LandingPublicCta;
  heroPrimary: LandingPublicCta;
  heroSecondary: LandingPublicCta;
  general: LandingPublicGeneral;
  pricing: LandingPublicPricing;
};

export type MergedPublicLandingDesign = {
  colors: LandingPublicColors;
  nav: LandingPublicNavItem[];
  headerBarCta: LandingPublicCta;
  heroPrimary: LandingPublicCta;
  heroSecondary: LandingPublicCta;
  general: LandingPublicGeneral;
  pricing: LandingPublicPricing;
};

const HEX6 = /^#([0-9a-fA-F]{6})$/;

export function normalizeHex6(input: string): string | null {
  const t = input.trim();
  if (HEX6.test(t)) return t.toLowerCase();
  const short = /^#([0-9a-fA-F]{3})$/;
  const m = t.match(short);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => c + c);
    return `#${r}${g}${b}`.toLowerCase();
  }
  return null;
}

export function isValidHref(href: string, linkType: LandingNavLinkType): boolean {
  const t = href.trim();
  if (t.length === 0 || t.length > 500) return false;
  if (linkType === "external") {
    return (
      /^https:\/\//i.test(t) ||
      /^http:\/\//i.test(t) ||
      /^mailto:/i.test(t) ||
      /^tel:/i.test(t)
    );
  }
  return t.startsWith("/") || t.startsWith("#");
}

export function inferLinkType(href: string): LandingNavLinkType {
  const t = href.trim();
  if (/^https?:\/\//i.test(t) || /^mailto:/i.test(t) || /^tel:/i.test(t)) return "external";
  return "internal";
}

export function defaultNavFromContent(): LandingPublicNavItem[] {
  return landingNav.map((item, index) => ({
    id: `nav-${index + 1}`,
    label: item.label,
    href: item.href,
    sortOrder: index + 1,
    isActive: true,
    linkType: inferLinkType(item.href),
  }));
}

export function defaultColors(): LandingPublicColors {
  return {
    primaryBg: "#c45c3a",
    primaryFg: "#fffaf8",
    primaryHoverBg: "#a84a2d",
    outlineFg: "#2c241c",
    outlineBorder: "#d4cfc8",
    outlineHoverBg: "#f0ebe4",
  };
}

export function defaultGeneral(): LandingPublicGeneral {
  return {
    brandName: landingBrand.name,
    brandTagline: landingBrand.tagline,
    showTaglineInHeader: true,
  };
}

export function defaultPricingFromContent(): LandingPublicPricing {
  return {
    sectionId: landingPricing.id.slice(0, 64),
    eyebrow: landingPricing.eyebrow,
    title: landingPricing.title,
    description: landingPricing.description,
    microTrust: [...landingPricing.microTrust],
    billingToggleEnabled: true,
    billingMonthlyLabel: "Aylık",
    billingYearlyLabel: "Yıllık",
    billingYearlyHint: "",
    plans: landingPricing.plans.map((p, i) => ({
      id: `plan-${i + 1}`,
      name: p.name,
      priceMonthly: p.price,
      periodMonthly: p.period,
      priceYearly: p.price,
      periodYearly: "yıllık faturalandırma",
      description: p.description,
      features: [...p.features],
      cta: { label: p.cta.label, href: p.cta.href },
      highlighted: p.highlighted,
      badge: "badge" in p && typeof p.badge === "string" ? p.badge : "",
    })),
  };
}

export function defaultCtAs(): Pick<
  LandingPublicDesignV1,
  "headerBarCta" | "heroPrimary" | "heroSecondary"
> {
  return {
    headerBarCta: {
      label: landingHero.primaryCta.label,
      href: landingHero.primaryCta.href,
      enabled: true,
    },
    heroPrimary: {
      label: landingHero.primaryCta.label,
      href: landingHero.primaryCta.href,
      enabled: true,
    },
    heroSecondary: {
      label: landingHero.secondaryCta.label,
      href: landingHero.secondaryCta.href,
      enabled: true,
    },
  };
}

export function defaultLandingPublicDesignV1(): LandingPublicDesignV1 {
  return {
    version: LANDING_PUBLIC_DESIGN_VERSION,
    colors: defaultColors(),
    nav: defaultNavFromContent(),
    ...defaultCtAs(),
    general: defaultGeneral(),
    pricing: defaultPricingFromContent(),
  };
}

function sanitizeColors(input: unknown): LandingPublicColors {
  const base = defaultColors();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const pick = (key: keyof LandingPublicColors) => {
    const v = o[key];
    if (typeof v !== "string") return base[key];
    const n = normalizeHex6(v);
    return n ?? base[key];
  };
  return {
    primaryBg: pick("primaryBg"),
    primaryFg: pick("primaryFg"),
    primaryHoverBg: pick("primaryHoverBg"),
    outlineFg: pick("outlineFg"),
    outlineBorder: pick("outlineBorder"),
    outlineHoverBg: pick("outlineHoverBg"),
  };
}

function sanitizeNav(input: unknown): LandingPublicNavItem[] {
  const fallback = defaultNavFromContent();
  if (!Array.isArray(input)) return fallback;
  const rows: LandingPublicNavItem[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim().slice(0, 64) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 80) : "";
    const href = typeof o.href === "string" ? o.href.trim().slice(0, 500) : "";
    const sortOrder =
      typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder) ? Math.max(0, o.sortOrder) : rows.length;
    const isActive = Boolean(o.isActive);
    const linkType: LandingNavLinkType = o.linkType === "external" ? "external" : "internal";
    if (!id || !label) continue;
    if (!isValidHref(href, linkType)) continue;
    rows.push({ id, label, href, sortOrder, isActive, linkType });
  }
  if (rows.length === 0) return fallback;
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

function sanitizeCta(input: unknown, fallback: LandingPublicCta): LandingPublicCta {
  if (!input || typeof input !== "object") return fallback;
  const o = input as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 120) : fallback.label;
  const href = typeof o.href === "string" ? o.href.trim().slice(0, 500) : fallback.href;
  const enabled = typeof o.enabled === "boolean" ? o.enabled : fallback.enabled;
  const linkType = inferLinkType(href);
  if (!isValidHref(href, linkType)) return fallback;
  return { label: label || fallback.label, href, enabled };
}

function sanitizeGeneral(input: unknown): LandingPublicGeneral {
  const base = defaultGeneral();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const brandName =
    typeof o.brandName === "string" ? o.brandName.trim().slice(0, 120) : base.brandName;
  const brandTagline =
    typeof o.brandTagline === "string" ? o.brandTagline.trim().slice(0, 180) : base.brandTagline;
  const showTaglineInHeader =
    typeof o.showTaglineInHeader === "boolean" ? o.showTaglineInHeader : base.showTaglineInHeader;
  return {
    brandName: brandName || base.brandName,
    brandTagline,
    showTaglineInHeader,
  };
}

function sanitizeSectionId(input: string, fallback: string): string {
  const t = input.trim().slice(0, 64);
  if (!t || /[<"'\s]/.test(t)) return fallback;
  return t;
}

function sanitizePricing(input: unknown): LandingPublicPricing {
  const base = defaultPricingFromContent();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const sectionId =
    typeof o.sectionId === "string"
      ? sanitizeSectionId(o.sectionId, base.sectionId)
      : base.sectionId;
  const eyebrow = typeof o.eyebrow === "string" ? o.eyebrow.trim().slice(0, 80) : base.eyebrow;
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 200) : base.title;
  const description =
    typeof o.description === "string" ? o.description.trim().slice(0, 500) : base.description;

  const billingToggleEnabled =
    typeof o.billingToggleEnabled === "boolean" ? o.billingToggleEnabled : base.billingToggleEnabled;
  const billingMonthlyLabel =
    typeof o.billingMonthlyLabel === "string"
      ? o.billingMonthlyLabel.trim().slice(0, 24)
      : base.billingMonthlyLabel;
  const billingYearlyLabel =
    typeof o.billingYearlyLabel === "string"
      ? o.billingYearlyLabel.trim().slice(0, 24)
      : base.billingYearlyLabel;
  const billingYearlyHint =
    typeof o.billingYearlyHint === "string"
      ? o.billingYearlyHint.trim().slice(0, 80)
      : base.billingYearlyHint;

  let microTrust: string[] = base.microTrust;
  if (Array.isArray(o.microTrust)) {
    const rows: string[] = [];
    for (const x of o.microTrust) {
      if (typeof x !== "string") continue;
      const t = x.trim().slice(0, 120);
      if (t) rows.push(t);
    }
    microTrust = rows.length > 0 ? rows.slice(0, 12) : base.microTrust;
  }

  let plans: LandingPublicPricingPlan[] = [];
  if (Array.isArray(o.plans)) {
    for (const raw of o.plans) {
      if (!raw || typeof raw !== "object") continue;
      const p = raw as Record<string, unknown>;
      const id =
        typeof p.id === "string" && p.id.trim().length > 0
          ? p.id.trim().slice(0, 64)
          : `plan-${plans.length + 1}`;
      const name = typeof p.name === "string" ? p.name.trim().slice(0, 120) : "";
      const legacyPrice = typeof p.price === "string" ? p.price.trim().slice(0, 48) : "";
      const legacyPeriod = typeof p.period === "string" ? p.period.trim().slice(0, 80) : "";
      const priceMonthlyRaw =
        typeof p.priceMonthly === "string" ? p.priceMonthly.trim().slice(0, 48) : "";
      const periodMonthlyRaw =
        typeof p.periodMonthly === "string" ? p.periodMonthly.trim().slice(0, 80) : "";
      const priceYearlyRaw = typeof p.priceYearly === "string" ? p.priceYearly.trim().slice(0, 48) : "";
      const periodYearlyRaw =
        typeof p.periodYearly === "string" ? p.periodYearly.trim().slice(0, 80) : "";
      const priceMonthly = priceMonthlyRaw || legacyPrice;
      const periodMonthly = periodMonthlyRaw || legacyPeriod;
      const priceYearly = priceYearlyRaw || legacyPrice || priceMonthly;
      const periodYearly =
        periodYearlyRaw || (legacyPeriod ? `${legacyPeriod} · yıllık` : "yıllık faturalandırma");
      const description = typeof p.description === "string" ? p.description.trim().slice(0, 400) : "";
      const features: string[] = [];
      if (Array.isArray(p.features)) {
        for (const f of p.features) {
          if (typeof f !== "string") continue;
          const ft = f.trim().slice(0, 240);
          if (ft) features.push(ft);
          if (features.length >= 24) break;
        }
      }
      const ctaRaw = p.cta && typeof p.cta === "object" ? (p.cta as Record<string, unknown>) : null;
      const ctaLabel =
        typeof ctaRaw?.label === "string" ? ctaRaw.label.trim().slice(0, 120) : base.plans[0]!.cta.label;
      const ctaHref =
        typeof ctaRaw?.href === "string" ? ctaRaw.href.trim().slice(0, 500) : base.plans[0]!.cta.href;
      const lt = inferLinkType(ctaHref);
      if (!isValidHref(ctaHref, lt)) continue;
      const highlighted = Boolean(p.highlighted);
      const badge = typeof p.badge === "string" ? p.badge.trim().slice(0, 48) : "";
      if (!name) continue;
      plans.push({
        id,
        name,
        priceMonthly: priceMonthly || "—",
        periodMonthly: periodMonthly || "—",
        priceYearly: priceYearly || "—",
        periodYearly: periodYearly || "—",
        description,
        features: features.length > 0 ? features : ["—"],
        cta: { label: ctaLabel || "Bilgi al", href: ctaHref },
        highlighted,
        badge,
      });
      if (plans.length >= 6) break;
    }
  }

  if (plans.length === 0) plans = base.plans;

  return {
    sectionId,
    eyebrow: eyebrow || base.eyebrow,
    title: title || base.title,
    description: description || base.description,
    microTrust,
    billingToggleEnabled,
    billingMonthlyLabel: billingMonthlyLabel || base.billingMonthlyLabel,
    billingYearlyLabel: billingYearlyLabel || base.billingYearlyLabel,
    billingYearlyHint,
    plans,
  };
}

/** DB JSON veya bilinmeyen girdiyi güvenli şekilde V1’e çevirir (fail-closed). */
export function parseLandingPublicDesign(raw: unknown): LandingPublicDesignV1 {
  const defaults = defaultLandingPublicDesignV1();
  if (!raw || typeof raw !== "object") return defaults;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return defaults;
  const ctas = defaultCtAs();
  return {
    version: 1,
    colors: sanitizeColors(o.colors),
    nav: sanitizeNav(o.nav),
    headerBarCta: sanitizeCta(o.headerBarCta, ctas.headerBarCta),
    heroPrimary: sanitizeCta(o.heroPrimary, ctas.heroPrimary),
    heroSecondary: sanitizeCta(o.heroSecondary, ctas.heroSecondary),
    general: sanitizeGeneral(o.general),
    pricing: sanitizePricing(o.pricing),
  };
}

/** Public sayfada gösterim: aktif ve sıralı nav; CTA’lar enabled bayrağına göre. */
export function toMergedPublicDesign(v: LandingPublicDesignV1): MergedPublicLandingDesign {
  const nav = v.nav.filter((n) => n.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    colors: v.colors,
    nav: nav.length > 0 ? nav : defaultNavFromContent().filter((x) => x.isActive),
    headerBarCta: v.headerBarCta,
    heroPrimary: v.heroPrimary,
    heroSecondary: v.heroSecondary,
    general: v.general,
    pricing: v.pricing,
  };
}

export function mergePublicDesignFromDb(json: unknown | null | undefined): MergedPublicLandingDesign {
  return toMergedPublicDesign(parseLandingPublicDesign(json ?? null));
}
