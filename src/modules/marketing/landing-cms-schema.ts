export const LANDING_SECTION_TYPES = [
  "announcement",
  "hero",
  "trustBar",
  "useCases",
  "featureGrid",
  "mockupShowcase",
  "demoRequestForm",
  "howItWorks",
  "faq",
  "finalCta",
] as const;

export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number];

export type LandingThemeTokens = {
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  success: string;
  warning: string;
  heroBadgeBg: string;
  heroBadgeText: string;
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  // Custom Visual Overrides
  heroGradientFrom?: string | null;
  heroGradientVia?: string | null;
  heroGradientTo?: string | null;
  headerBackground?: string | null;
  headerBorderColor?: string | null;
};

export const DEFAULT_LANDING_THEME: LandingThemeTokens = {
  background: "#020617",
  surface: "#070e24",
  surfaceAlt: "#0f1b3d",
  card: "#0d1730",
  border: "#1e293b",
  textPrimary: "#f8fafc",
  textSecondary: "#94a3b8",
  accent: "#38bdf8",
  accentHover: "#7dd3fc",
  success: "#10b981",
  warning: "#f59e0b",
  heroBadgeBg: "#1e293b",
  heroBadgeText: "#e2e8f0",
  buttonPrimaryBg: "#ffffff",
  buttonPrimaryText: "#020617",
  buttonSecondaryBg: "#1e293b",
  buttonSecondaryText: "#f8fafc",
  // Fallbacks
  heroGradientFrom: "#020617",
  heroGradientVia: "#0b3b8f",
  heroGradientTo: "#071a3a",
  headerBackground: "#020617",
  headerBorderColor: "rgba(255,255,255,0.08)",
};

export type LandingBadgeItem = {
  label: string;
  sublabel?: string;
};

export type LandingStatItem = {
  label: string;
  value: string;
  sublabel?: string;
};

export type LandingCardItem = {
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  bullets?: string[];
  tags?: string[];
};

export type LandingFormTexts = {
  title?: string;
  description?: string;
  submitLabel?: string;
  consentText?: string;
  note?: string;
  successMessage?: string;
};

export type LandingSectionVisuals = {
  isEnabledVisuals?: boolean;
  backgroundMode?: "default" | "custom";
  backgroundColor?: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  borderColor?: string;
};

export type LandingFooterConfig = {
  isEnabled: boolean;
  background?: string;
  borderColor?: string;
  textColor?: string;
  contentRichText?: string;
  customCode?: string;
};

export const DEFAULT_LANDING_FOOTER: LandingFooterConfig = {
  isEnabled: true,
  background: "#020617",
  borderColor: "rgba(255,255,255,0.08)",
  textColor: "#94a3b8",
  contentRichText: "",
  customCode: "",
};

export type LandingSectionPayload = {
  bullets?: string[];
  badges?: LandingBadgeItem[];
  stats?: LandingStatItem[];
  cards?: LandingCardItem[];
  formTexts?: LandingFormTexts;
  visuals?: LandingSectionVisuals; // Section based visual overrides
};

export type LandingSectionConfig = {
  sectionType: LandingSectionType;
  isEnabled: boolean;
  sortOrder: number;
  eyebrowHtml: string;
  titleHtml: string;
  subtitleHtml: string;
  bodyHtml: string;
  ctaPrimaryLabelHtml: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabelHtml: string;
  ctaSecondaryHref: string;
  mediaUrl: string;
  mediaAlt: string;
  mediaCaptionHtml: string;
  payload: LandingSectionPayload;
};

export type LandingNavigationChildItem = {
  id?: number;
  title: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
  badgeText?: string | null;
  openInNewTab?: boolean;
};

export type LandingNavigationItem = {
  id?: number;
  title: string;
  slug: string;
  href: string;
  sortOrder: number;
  isActive: boolean;
  badgeText?: string | null;
  openInNewTab?: boolean;
  children: LandingNavigationChildItem[];
};

export type LandingSectionEditorSpec = {
  type: LandingSectionType;
  label: string;
  description: string;
  supports: {
    eyebrow: boolean;
    title: boolean;
    subtitle: boolean;
    body: boolean;
    ctaPrimary: boolean;
    ctaSecondary: boolean;
    media: boolean;
    bullets: boolean;
    badges: boolean;
    stats: boolean;
    cards: boolean;
    formTexts: boolean;
  };
};

export const LANDING_SECTION_SPECS: LandingSectionEditorSpec[] = [
  {
    type: "announcement",
    label: "Announcement",
    description: "Ust bilgilendirme satiri ve baglantisi.",
    supports: {
      eyebrow: false,
      title: false,
      subtitle: false,
      body: true,
      ctaPrimary: true,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: false,
      formTexts: false,
    },
  },
  {
    type: "hero",
    label: "Hero",
    description: "Ilk ekran deger onermesi ve ana CTA grubu.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: true,
      ctaSecondary: true,
      media: true,
      bullets: true,
      badges: false,
      stats: false,
      cards: false,
      formTexts: false,
    },
  },
  {
    type: "trustBar",
    label: "Guven / Sosyal Kanit",
    description: "Guven metrikleri, rozetler ve referans satiri.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: true,
      stats: true,
      cards: false,
      formTexts: false,
    },
  },
  {
    type: "useCases",
    label: "Kullanim Alanlari",
    description: "Kategori ve alt kategori kartlari.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: true,
      formTexts: false,
    },
  },
  {
    type: "featureGrid",
    label: "Urun Katmanlari",
    description: "QR menu, operasyon ve merkez yonetim bloklari.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: true,
      formTexts: false,
    },
  },
  {
    type: "mockupShowcase",
    label: "Mockup Showcase",
    description: "Urun vitrini ve panel gorunumu metinleri.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: true,
      ctaSecondary: false,
      media: true,
      bullets: true,
      badges: false,
      stats: true,
      cards: false,
      formTexts: false,
    },
  },
  {
    type: "demoRequestForm",
    label: "Lead Form",
    description: "Form basligi, aciklama ve guven metinleri.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: true,
      badges: false,
      stats: false,
      cards: false,
      formTexts: true,
    },
  },
  {
    type: "howItWorks",
    label: "Nasil Calisir",
    description: "3 adimli operasyon akisi.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: true,
      formTexts: false,
    },
  },
  {
    type: "faq",
    label: "SSS",
    description: "Sik sorulan sorular ve yanitlar.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: false,
      ctaSecondary: false,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: true,
      formTexts: false,
    },
  },
  {
    type: "finalCta",
    label: "Final CTA",
    description: "Sayfa kapanis cagrisi.",
    supports: {
      eyebrow: true,
      title: true,
      subtitle: true,
      body: true,
      ctaPrimary: true,
      ctaSecondary: true,
      media: false,
      bullets: false,
      badges: false,
      stats: false,
      cards: false,
      formTexts: false,
    },
  },
];

const SECTION_SPEC_MAP = new Map(
  LANDING_SECTION_SPECS.map((item) => [item.type, item] as const),
);

export function getLandingSectionSpec(type: LandingSectionType): LandingSectionEditorSpec {
  const spec = SECTION_SPEC_MAP.get(type);
  if (!spec) {
    throw new Error(`Unsupported section type: ${type}`);
  }
  return spec;
}

export function isLandingSectionType(input: string): input is LandingSectionType {
  return (LANDING_SECTION_TYPES as readonly string[]).includes(input);
}

export function createEmptyLandingSection(sectionType: LandingSectionType, sortOrder: number): LandingSectionConfig {
  return {
    sectionType,
    isEnabled: true,
    sortOrder,
    eyebrowHtml: "",
    titleHtml: "",
    subtitleHtml: "",
    bodyHtml: "",
    ctaPrimaryLabelHtml: "",
    ctaPrimaryHref: "",
    ctaSecondaryLabelHtml: "",
    ctaSecondaryHref: "",
    mediaUrl: "",
    mediaAlt: "",
    mediaCaptionHtml: "",
    payload: {},
  };
}

export function getDefaultLandingSections(): LandingSectionConfig[] {
  return LANDING_SECTION_TYPES.map((type, index) => createEmptyLandingSection(type, index + 1));
}
