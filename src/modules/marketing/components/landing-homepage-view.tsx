import React from "react";
import Link from "next/link";
import { buttonClasses } from "@/lib/ui/button-variants";
import { LandingLeadForm } from "@/modules/marketing/components/landing-lead-form";
import type { MarketingLandingPublicData } from "@/modules/marketing/server/landing-content";
import type { LandingSectionPayload } from "@/modules/marketing/landing-cms-schema";
import { sanitizeRichTextHtml, stripHtml } from "@/modules/marketing/server/rich-text";

type LandingHomepageViewProps = {
  data: MarketingLandingPublicData;
  tracking: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmTerm: string;
    utmContent: string;
    landingPath: string;
    referrer: string;
  };
};

type ValueBlock = {
  key: string;
  title: string;
  description: string;
  bullets: string[];
  ctaLabel: string | null;
  ctaHref: string | null;
};

type MetricCard = {
  title: string;
  description: string;
};

function hrefOrFallback(value: string | null | undefined, fallback = "#lead-form"): string {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function buildHeroBenefits(data: NonNullable<MarketingLandingPublicData>): string[] {
  if (data.trustBadges.length > 0) {
    return data.trustBadges.slice(0, 4).map((item) => plainText(item.label)).filter((v) => v.length > 0);
  }
  return [];
}

function buildBusinessSegments(data: NonNullable<MarketingLandingPublicData>): string[] {
  if (data.categories.length > 0) {
    return data.categories.slice(0, 4).map((category) => plainText(category.title)).filter((v) => v.length > 0);
  }
  return [];
}

function buildMetricCards(data: NonNullable<MarketingLandingPublicData>): MetricCard[] {
  if (data.trustBadges.length > 0) {
    return data.trustBadges.slice(0, 4).map((item) => ({
      title: plainText(item.label),
      description: plainText(item.sublabel) || "Sahada olculebilir operasyon etkisi.",
    }));
  }
  return [];
}

function buildValueBlocks(data: NonNullable<MarketingLandingPublicData>): ValueBlock[] {
  const defaults: Array<Pick<ValueBlock, "key" | "title" | "description" | "bullets">> = [
    {
      key: "qr",
      title: "QR Menu ve Siparis",
      description:
        "Musterinin menuyu kesfetmesini ve siparisi hizli tamamlamasini saglayan net bir dijital masa deneyimi.",
      bullets: [
        "Masa bazli hizli menu acilisi",
        "Siparis adimlarinda dusuk friksiyon",
        "Musteri tarafinda daha akici deneyim",
      ],
    },
    {
      key: "ops",
      title: "Garson ve Mutfak Gorunurlugu",
      description:
        "Siparis yasam dongusunu ekipler icin daha okunur hale getirerek servis koordinasyonunu guclendirir.",
      bullets: [
        "Anlik siparis takibi",
        "Masa taleplerinde net aksiyon",
        "Servis gecikmelerinde erken farkindalik",
      ],
    },
    {
      key: "hq",
      title: "Merkezi Yonetim ve Kontrol",
      description:
        "Buyume surecinde operasyon verisini, tenant yonetimini ve satis akislarini tek bir merkezde toplar.",
      bullets: [
        "Tek panelde operasyon gorunumu",
        "Sahada standardizasyon destegi",
        "Yonetim kararlarinda daha net veri zemini",
      ],
    },
  ];

  if (data.features.length === 0) return [];

  return data.features.slice(0, 3).map((feature, index) => {
    const item = defaults[index] ?? defaults[defaults.length - 1];
    const category = data.categories[index];
    const categoryBullets =
      category?.subcategories
        .slice(0, 3)
        .map((sub) => plainText(sub.title))
        .filter((value) => value.length > 0) ?? [];

    return {
      key: item.key,
      title: plainText(feature?.title) || item.title,
      description: plainText(feature?.description) || item.description,
      bullets: categoryBullets.length > 0 ? categoryBullets : item.bullets,
      ctaLabel: plainText(feature?.ctaLabel) || null,
      ctaHref: feature?.ctaHref ?? null,
    };
  });
}

function buildHowSteps(data: NonNullable<MarketingLandingPublicData>) {
  if (data.howItWorks.length > 0) {
    return data.howItWorks.slice(0, 3).map((step) => ({
      ...step,
      title: plainText(step.title),
      description: plainText(step.description),
    }));
  }
  return [];
}

function buildUseCaseCards(data: NonNullable<MarketingLandingPublicData>) {
  if (data.categories.length > 0) {
    return data.categories.slice(0, 4).map((category) => ({
      title: plainText(category.title),
      description: plainText(category.description) || "Bu segmente uygun operasyon kurgusuyla hizli baslangic.",
    }));
  }
  return [];
}

function HeaderSection({
  title,
  description,
  align = "left",
}: {
  title: string;
  description?: string | null;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      {description && description.length > 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)] sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function hasText(value: string | null | undefined): boolean {
  return (value ?? "").trim().length > 0;
}

function plainText(value: string | null | undefined): string {
  const sanitized = sanitizeRichTextHtml(value ?? "");
  return stripHtml(sanitized);
}

function plainTextOr(value: string | null | undefined, fallback: string): string {
  const candidate = plainText(value);
  if (candidate.length > 0) return candidate;
  return plainText(fallback);
}

function ProductPreviewMock({
  brandName,
  valueBlocks,
  howSteps,
}: {
  brandName: string;
  valueBlocks: ValueBlock[];
  howSteps: Array<{ id: number | string; title: string }>;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -left-6 top-8 h-24 w-24 rounded-full bg-[var(--ui-accent)]/20 blur-2xl" />
      <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-[var(--ui-primary)]/20 blur-2xl" />

      <div className="relative rounded-3xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-surface-elevated)_88%,black)] p-4 shadow-[0_24px_70px_rgba(5,10,22,0.6)] sm:p-5">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] px-3 py-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ui-text-muted)]">Canli panel</p>
            <p className="text-sm font-semibold text-white">{brandName}</p>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
            Operasyon Aktif
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {valueBlocks.slice(0, 2).map((block) => (
            <article
              key={block.key}
              className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/70 p-3"
            >
              <p className="text-sm font-semibold text-white">{plainText(block.title)}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-secondary)]">
                {plainText(block.bullets[0] ?? block.description)}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Akis adimlari</p>
          <ul className="mt-2 space-y-2">
            {howSteps.slice(0, 3).map((step, index) => (
              <li key={`${step.id}`} className="flex items-start gap-2 text-xs text-[var(--ui-text-secondary)]">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-accent)]/20 text-[11px] font-semibold text-[var(--ui-accent)]">
                  {index + 1}
                </span>
                <span>{plainText(step.title)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ValueBlockCard({ block, reverse }: { block: ValueBlock; reverse?: boolean }) {
  return (
    <article
      className={`grid items-center gap-6 rounded-3xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-surface-elevated)_82%,black)] p-5 shadow-[0_18px_55px_rgba(4,9,20,0.5)] md:grid-cols-2 md:p-8 ${
        reverse ? "md:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{plainText(block.title)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)] sm:text-base">
          {plainText(block.description)}
        </p>
        <ul className="mt-4 space-y-2">
          {block.bullets.slice(0, 3).map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[var(--ui-text-secondary)]">
              <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--ui-accent)]" />
              <span>{plainText(item)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--ui-text-muted)]">Canli fayda ozeti</p>
        <div className="mt-3 space-y-2">
          {block.bullets.slice(0, 3).map((item) => (
            <div
              key={`preview-${item}`}
              className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] px-3 py-2 text-xs text-[var(--ui-text-secondary)]"
            >
              {plainText(item)}
            </div>
          ))}
        </div>
        {hasText(block.ctaLabel) ? (
          <div className="mt-4">
            <Link
              href={hrefOrFallback(block.ctaHref)}
              className={buttonClasses({ variant: "outline", size: "sm", className: "gap-2" })}
            >
              {plainText(block.ctaLabel)}
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function LandingHomepageView({ data, tracking }: LandingHomepageViewProps) {
  const brandName = plainTextOr(data?.brandName, "CATAL APP");
  const brandTagline = plainTextOr(
    data?.brandTagline,
    "QR menu ve siparis operasyonunu hizlandiran restoran platformu",
  );

  // Schema-driven content resolver
  const getSection = (type: string) => data?.landingSections?.find((s) => s.sectionType === type);

  const heroSection = getSection("hero");
  const announcementSection = getSection("announcement");
  const trustBarSection = getSection("trustBar");
  const featureGridSection = getSection("featureGrid");
  const howItWorksSection = getSection("howItWorks");
  const faqSection = getSection("faq");
  const finalCtaSection = getSection("finalCta");
  const formSection = getSection("demoRequestForm");
  const categoriesSection = getSection("useCases");

  const heroPayload = heroSection?.payload as LandingSectionPayload | undefined;
  const trustBarPayload = trustBarSection?.payload as LandingSectionPayload | undefined;
  const featureGridPayload = featureGridSection?.payload as LandingSectionPayload | undefined;
  const howItWorksPayload = howItWorksSection?.payload as LandingSectionPayload | undefined;
  const categoriesPayload = categoriesSection?.payload as LandingSectionPayload | undefined;
  const faqPayload = faqSection?.payload as LandingSectionPayload | undefined;
  const formPayload = formSection?.payload as LandingSectionPayload | undefined;

  // Hero overrides — all plain text to avoid hydration mismatch
  const heroKicker = plainTextOr(heroSection?.eyebrowHtml || data?.heroKicker, "Restoranlar Icin Satisa Donusen Dijital Deneyim");
  const heroTitle = plainTextOr(
    heroSection?.titleHtml || data?.heroTitle,
    "Masaya gelen QR ile siparis surecini hizlandirin, servis kalitesini kontrollu sekilde buyutun.",
  );
  const heroDescription = plainTextOr(
    heroSection?.bodyHtml || data?.heroDescription,
    "CATAL APP; musteri, garson ve mutfak akislarini tek operasyonda birlestirerek restoraniniza hiz ve netlik kazandirir.",
  );
  const heroPrimaryLabel = plainTextOr(heroSection?.ctaPrimaryLabelHtml || data?.heroPrimaryCtaLabel, "Demo Talep Et");
  const heroPrimaryHref = hrefOrFallback(heroSection?.ctaPrimaryHref || data?.heroPrimaryCtaHref);
  const heroSecondaryLabel = plainTextOr(
    heroSection?.ctaSecondaryLabelHtml || data?.heroSecondaryCtaLabel,
    "Canli Onizleme",
  );
  const heroSecondaryHref = hrefOrFallback(heroSection?.ctaSecondaryHref || data?.heroSecondaryCtaHref);

  // Announcement
  const announcementText = plainText(announcementSection?.bodyHtml || data?.announcementText);
  const announcementCtaLabel = plainText(announcementSection?.ctaPrimaryLabelHtml || data?.announcementCtaLabel);
  const announcementCtaHref = hrefOrFallback(announcementSection?.ctaPrimaryHref || data?.announcementCtaHref);
  const showAnnouncement = Boolean(
    (announcementSection?.isEnabled ?? data?.announcementEnabled) && announcementText.length > 0,
  );

  const heroBenefits = heroPayload?.bullets?.length ? heroPayload.bullets.map(plainText).filter(v => v.length > 0) : (data ? buildHeroBenefits(data) : []);
  const businessSegments = data ? buildBusinessSegments(data) : [];
  const metricCards = trustBarPayload?.badges?.length 
    ? trustBarPayload.badges.map(b => ({ title: plainText(b.label), description: plainText(b.sublabel ?? "") }))
    : (data ? buildMetricCards(data) : []);
  const valueBlocks = featureGridPayload?.cards?.length
    ? featureGridPayload.cards.map((c, idx) => ({
        key: plainText(c.title) || `feature-card-${idx}`,
        title: plainText(c.title),
        description: plainText(c.body),
        bullets: (c.bullets || []).map((item) => plainText(item)).filter((item) => item.length > 0),
        ctaLabel: plainText(c.ctaLabel) || null,
        ctaHref: c.ctaHref || null,
      }))
    : (data ? buildValueBlocks(data) : []);
  const howSteps = howItWorksPayload?.cards?.length
    ? howItWorksPayload.cards.map((c, i) => ({ id: i, title: plainText(c.title), description: plainText(c.body) }))
    : (data ? buildHowSteps(data) : []);
  const useCaseCards = categoriesPayload?.cards?.length
    ? categoriesPayload.cards.map((c, index) => ({
        title: plainText(c.title) || `card-${index + 1}`,
        description: plainText(c.body),
      }))
    : (data ? buildUseCaseCards(data) : []);

  const logos = data?.logos ?? [];
  const faqs = faqPayload?.cards?.length
    ? faqPayload.cards.map((c, i) => ({ id: i, question: plainText(c.title), answer: plainText(c.body) }))
    : (data?.faqs ?? []).map((f) => ({ ...f, question: plainText(f.question), answer: plainText(f.answer) }));

  const showBusinessBand = businessSegments.length > 0;
  const showMetricSection = (trustBarSection?.isEnabled ?? true) && metricCards.length > 0;
  const showValueSection = (featureGridSection?.isEnabled ?? true) && valueBlocks.length > 0;
  const showHowSection = (howItWorksSection?.isEnabled ?? true) && howSteps.length > 0;
  const showUseCases = (categoriesSection?.isEnabled ?? true) && useCaseCards.length > 0;
  const showFaqSection = (faqSection?.isEnabled ?? true) && faqs.length > 0;

  const trustTitle = plainTextOr(trustBarSection?.titleHtml || data?.trustSectionTitle, "Sahada guvenle calisan ekiplerin tercihi");
  const trustDescription = plainTextOr(
    trustBarSection?.subtitleHtml || data?.trustSectionDescription,
    "Canli operasyon odagi, mobil siparis deneyimi ve merkezi kontrol tek akis icinde bulusur.",
  );

  const featuresTitle = plainTextOr(featureGridSection?.titleHtml || data?.featuresSectionTitle, "Operasyonu guclendiren urun katmanlari");
  const featuresDescription = plainTextOr(
    featureGridSection?.subtitleHtml || data?.featuresSectionDescription,
    "QR siparis, ekip koordinasyonu ve yonetim kontrolunu tek bir satis motorunda birlestirin.",
  );

  const howTitle = plainTextOr(howItWorksSection?.titleHtml || data?.howItWorksSectionTitle, "Nasil calisir");
  const howDescription = plainTextOr(
    howItWorksSection?.subtitleHtml || data?.howItWorksSectionDescription,
    "Kurulum adimlari net oldugu icin ekip hizli adapte olur ve operasyon aksatmadan ilerler.",
  );

  const categoryTitle = plainTextOr(categoriesSection?.titleHtml || data?.categorySectionTitle, "Kullanim alanlari");
  const categoryDescription = plainTextOr(
    categoriesSection?.subtitleHtml || data?.categorySectionDescription,
    "Farkli servis modellerine uygun akislarla restoran tipinize en dogru kurguyu secin.",
  );

  const formTitle = plainTextOr(
    formSection?.titleHtml || formPayload?.formTexts?.title || data?.formSectionTitle,
    "Operasyonunuza uygun demo plani olusturalim",
  );
  const formDescription = plainTextOr(
    formSection?.subtitleHtml || formPayload?.formTexts?.description || data?.formSectionDescription,
    "Kisa formu doldurun; ekip yapiniza ve servis modelinize uygun kurulum akisini birlikte netlestirelim.",
  );

  const ctaTitle = plainTextOr(
    finalCtaSection?.titleHtml || data?.ctaSectionTitle,
    "Restoraninizi hizlandiran operasyon modelini birlikte kuralim",
  );
  const ctaDescription = plainTextOr(
    finalCtaSection?.subtitleHtml || data?.ctaSectionDescription,
    "Canli bir gorusme ile mevcut akisinizdaki yavaslatan adimlari belirleyip net bir uygulama plani cikaralim.",
  );
  const ctaPrimaryLabel = plainTextOr(
    finalCtaSection?.ctaPrimaryLabelHtml || data?.ctaPrimaryLabel,
    "Demo Randevusu Al",
  );
  const ctaPrimaryHref = hrefOrFallback(finalCtaSection?.ctaPrimaryHref || data?.ctaPrimaryHref);

  // Theme integration
  const theme = data?.landingTheme;
  const themeVars = theme ? {
    "--ui-bg": theme.background,
    "--ui-surface": theme.surface,
    "--ui-surface-alt": theme.surfaceAlt,
    "--ui-card": theme.card,
    "--ui-border": theme.border,
    "--ui-text-primary": theme.textPrimary,
    "--ui-text-secondary": theme.textSecondary,
    "--ui-accent": theme.accent,
    "--ui-accent-hover": theme.accentHover,
    "--ui-success": theme.success,
    "--ui-warning": theme.warning,
    "--ui-hero-badge-bg": theme.heroBadgeBg,
    "--ui-hero-badge-text": theme.heroBadgeText,
    "--ui-button-primary-bg": theme.buttonPrimaryBg,
    "--ui-button-primary-text": theme.buttonPrimaryText,
    "--ui-button-secondary-bg": theme.buttonSecondaryBg,
    "--ui-button-secondary-text": theme.buttonSecondaryText,
  } as React.CSSProperties : undefined;

  return (
    <main 
      className="marketing-surface marketing-backdrop relative min-h-screen overflow-hidden pb-14 text-[var(--ui-text-primary)]"
      style={themeVars}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] marketing-grid-bg opacity-70" />

      {showAnnouncement ? (
        <section className="relative border-b border-[var(--ui-border-subtle)]/80 bg-[var(--ui-surface-bg)]/75">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-[var(--ui-text-secondary)] sm:px-6 lg:px-8">
            <p>{announcementText}</p>
            {hasText(announcementCtaLabel) ? (
              <Link
                href={announcementCtaHref}
                className="text-[var(--ui-accent)] hover:text-[var(--ui-text-primary)]"
              >
                {announcementCtaLabel}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-[var(--ui-border-subtle)]/80 bg-[#070b12]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="group">
              <p className="text-base font-semibold tracking-tight text-white group-hover:text-[var(--ui-accent)] transition-colors">{brandName}</p>
              <p className="hidden text-[10px] text-[var(--ui-text-muted)] sm:block">{brandTagline}</p>
            </Link>

            {data?.landingNavItems && data.landingNavItems.length > 0 && (
              <nav className="hidden lg:flex items-center gap-6">
                {data.landingNavItems.map((item) => (
                  <div key={item.slug} className="relative group/nav">
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? "_blank" : undefined}
                      className="text-sm font-medium text-[var(--ui-text-secondary)] hover:text-white transition-colors flex items-center gap-1"
                    >
                      {plainText(item.title)}
                      {item.badgeText && (
                        <span className="rounded-full bg-[var(--ui-accent)]/20 px-1.5 py-0.5 text-[9px] font-bold text-[var(--ui-accent)] uppercase">
                          {plainText(item.badgeText)}
                        </span>
                      )}
                      {item.subitems && item.subitems.length > 0 && (
                        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </Link>

                    {item.subitems && item.subitems.length > 0 && (
                      <div className="absolute left-0 top-full pt-2 hidden group-hover/nav:block w-48 animate-in fade-in slide-in-from-top-1">
                        <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 shadow-xl">
                          {item.subitems.map((sub) => (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              target={sub.openInNewTab ? "_blank" : undefined}
                              className="block rounded-lg px-3 py-2 text-xs font-medium text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-alt)] hover:text-white transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{plainText(sub.title)}</span>
                                {sub.badgeText && (
                                  <span className="rounded-full bg-[var(--ui-accent)]/20 px-1.5 py-0.5 text-[8px] font-bold text-[var(--ui-accent)]">
                                    {plainText(sub.badgeText)}
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={heroSecondaryHref}
              className={buttonClasses({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
            >
              {heroSecondaryLabel}
            </Link>
            <Link
              href={heroPrimaryHref}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              {heroPrimaryLabel}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 md:pt-16 lg:grid-cols-12 lg:px-8 lg:pt-20">
          <div className="space-y-6 lg:col-span-6">
            <span className="inline-flex rounded-full border border-[var(--ui-border-strong)] bg-[var(--ui-surface-subtle)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ui-text-secondary)]">
              {heroKicker}
            </span>

            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="max-w-2xl text-pretty text-base leading-relaxed text-[var(--ui-text-secondary)] sm:text-lg">
              {heroDescription}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={heroPrimaryHref}
                className={buttonClasses({ variant: "primary", className: "w-full justify-center sm:w-auto" })}
              >
                {heroPrimaryLabel}
              </Link>
              <Link
                href={heroSecondaryHref}
                className={buttonClasses({ variant: "secondary", className: "w-full justify-center sm:w-auto" })}
              >
                {heroSecondaryLabel}
              </Link>
            </div>

            {heroBenefits.length > 0 ? (
              <ul className="grid gap-2 pt-1 sm:grid-cols-2">
                {heroBenefits.slice(0, 4).map((item) => (
                  <li
                    key={item}
                    className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/70 px-3 py-2 text-xs text-[var(--ui-text-secondary)]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="lg:col-span-6">
            <ProductPreviewMock brandName={brandName} valueBlocks={valueBlocks} howSteps={howSteps} />
          </div>
        </div>
      </section>

      {showBusinessBand ? (
        <section className="relative border-y border-[var(--ui-border-subtle)]/90 bg-[var(--ui-surface-bg)]/75">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-5 sm:px-6 lg:px-8">
            {businessSegments.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-elevated)] px-4 py-2 text-xs font-medium tracking-wide text-[var(--ui-text-secondary)]"
              >
                {item}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {showMetricSection ? (
        <section className="relative px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <HeaderSection title={trustTitle} description={trustDescription} align="center" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => (
                <article
                  key={metric.title}
                  className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-elevated)]/85 p-4"
                >
                  <p className="text-base font-semibold text-white">{metric.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">
                    {metric.description}
                  </p>
                </article>
              ))}
            </div>

            {logos.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {logos.slice(0, 6).map((logo) => (
                  <div
                    key={logo.id}
                    className="flex min-h-[52px] items-center justify-between rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] px-4"
                  >
                    <span className="text-xs uppercase tracking-[0.15em] text-[var(--ui-text-muted)]">
                      Referans
                    </span>
                    <span className="text-sm font-medium text-[var(--ui-text-secondary)]">{logo.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section id="lead-form" className="relative px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 rounded-3xl border border-[var(--ui-border)] bg-[color-mix(in_srgb,var(--ui-surface-elevated)_86%,black)] p-5 shadow-[0_20px_65px_rgba(5,10,24,0.5)] md:grid-cols-12 md:p-8">
          <div className="md:col-span-5">
            <span className="inline-flex rounded-full border border-[var(--ui-border-strong)] bg-[var(--ui-surface-subtle)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--ui-text-secondary)]">
              Demo Talep Formu
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {formTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ui-text-secondary)] sm:text-base">
              {formDescription}
            </p>
            <ul className="mt-4 space-y-2">
              {heroBenefits.slice(0, 3).map((item) => (
                <li key={`form-benefit-${item}`} className="flex items-start gap-2 text-sm text-[var(--ui-text-secondary)]">
                  <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--ui-accent)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-7">
            <div className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] p-4 sm:p-5">
              <LandingLeadForm
                submitLabel={plainTextOr(data?.formSubmitLabel, "Basvuru Gonder")}
                consentText={plainText(data?.formConsentText) || null}
                trustBullets={heroBenefits.map((item) => plainText(item)).filter((item) => item.length > 0)}
                tracking={tracking}
              />
            </div>
          </div>
        </div>
      </section>

      {showValueSection ? (
        <section id="features" className="relative px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <HeaderSection title={featuresTitle} description={featuresDescription} align="center" />
            <div className="space-y-5">
              {valueBlocks.map((block, index) => (
                <ValueBlockCard key={block.key} block={block} reverse={index % 2 === 1} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showHowSection ? (
        <section className="relative px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <HeaderSection title={howTitle} description={howDescription} align="center" />
            <div className="grid gap-4 md:grid-cols-3">
              {howSteps.map((step, index) => (
                <article
                  key={`${step.id}`}
                  className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-elevated)]/85 p-5"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ui-accent)]/15 text-sm font-semibold text-[var(--ui-accent)]">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">
                    {step.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showUseCases ? (
        <section className="relative px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-8">
            <HeaderSection title={categoryTitle} description={categoryDescription} align="center" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {useCaseCards.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-elevated)]/85 p-4"
                >
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showFaqSection ? (
        <section className="relative px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto w-full max-w-4xl space-y-8">
            <HeaderSection
              title={plainTextOr(data?.faqSectionTitle, "Sik Sorulan Sorular")}
              description={plainText(data?.faqSectionDescription) || null}
              align="center"
            />
            <div className="space-y-3">
              {faqs.map((faq) => (
                <article
                  key={faq.id}
                  className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-elevated)]/85 p-4 sm:p-5"
                >
                  <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="mx-auto w-full max-w-6xl rounded-3xl border border-[var(--ui-border-strong)] bg-[linear-gradient(145deg,rgba(20,31,50,0.96),rgba(15,22,36,0.88))] p-6 shadow-[0_20px_70px_rgba(4,8,20,0.58)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {ctaTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ui-text-secondary)] sm:text-base">
                {ctaDescription}
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                href={ctaPrimaryHref}
                className={buttonClasses({ variant: "primary", className: "w-full justify-center sm:w-auto" })}
              >
                {ctaPrimaryLabel}
              </Link>
              <Link
                href={hrefOrFallback(data?.heroSecondaryCtaHref)}
                className={buttonClasses({ variant: "secondary", className: "w-full justify-center sm:w-auto" })}
              >
                {heroSecondaryLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-[var(--ui-border-subtle)]/80 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 text-xs text-[var(--ui-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>{brandName}</p>
          <p>QR menu, siparis ve operasyon yonetimi icin merkezi platform.</p>
        </div>
      </footer>
    </main>
  );
}
