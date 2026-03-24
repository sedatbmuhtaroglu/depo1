import Link from "next/link";
import { buttonClasses } from "@/lib/ui/button-variants";
import { LandingLeadForm } from "@/modules/marketing/components/landing-lead-form";
import type { MarketingLandingPublicData } from "@/modules/marketing/server/landing-content";

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
    return data.trustBadges.slice(0, 4).map((item) => item.label);
  }
  return [];
}

function buildBusinessSegments(data: NonNullable<MarketingLandingPublicData>): string[] {
  if (data.categories.length > 0) {
    return data.categories.slice(0, 4).map((category) => category.title);
  }
  return [];
}

function buildMetricCards(data: NonNullable<MarketingLandingPublicData>): MetricCard[] {
  if (data.trustBadges.length > 0) {
    return data.trustBadges.slice(0, 4).map((item) => ({
      title: item.label,
      description: item.sublabel ?? "Sahada olculebilir operasyon etkisi.",
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
        .map((sub) => sub.title)
        .filter((value) => value.length > 0) ?? [];

    return {
      key: item.key,
      title: feature?.title ?? item.title,
      description: feature?.description ?? item.description,
      bullets: categoryBullets.length > 0 ? categoryBullets : item.bullets,
      ctaLabel: feature?.ctaLabel ?? null,
      ctaHref: feature?.ctaHref ?? null,
    };
  });
}

function buildHowSteps(data: NonNullable<MarketingLandingPublicData>) {
  if (data.howItWorks.length > 0) {
    return data.howItWorks.slice(0, 3);
  }
  return [];
}

function buildUseCaseCards(data: NonNullable<MarketingLandingPublicData>) {
  if (data.categories.length > 0) {
    return data.categories.slice(0, 4).map((category) => ({
      title: category.title,
      description: category.description ?? "Bu segmente uygun operasyon kurgusuyla hizli baslangic.",
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
      {description ? (
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

function textOr(value: string | null | undefined, fallback: string): string {
  return hasText(value) ? value!.trim() : fallback;
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
              <p className="text-sm font-semibold text-white">{block.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ui-text-secondary)]">
                {block.bullets[0] ?? block.description}
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
                <span>{step.title}</span>
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
        <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{block.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)] sm:text-base">
          {block.description}
        </p>
        <ul className="mt-4 space-y-2">
          {block.bullets.slice(0, 3).map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[var(--ui-text-secondary)]">
              <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--ui-accent)]" />
              <span>{item}</span>
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
              {item}
            </div>
          ))}
        </div>
        {hasText(block.ctaLabel) ? (
          <div className="mt-4">
            <Link
              href={hrefOrFallback(block.ctaHref)}
              className={buttonClasses({ variant: "outline", size: "sm", className: "gap-2" })}
            >
              {block.ctaLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function LandingHomepageView({ data, tracking }: LandingHomepageViewProps) {
  const brandName = textOr(data?.brandName, "CATAL APP");
  const brandTagline = textOr(
    data?.brandTagline,
    "QR menu ve siparis operasyonunu hizlandiran restoran platformu",
  );

  const heroKicker = textOr(data?.heroKicker, "Restoranlar Icin Satisa Donusen Dijital Deneyim");
  const heroTitle = textOr(
    data?.heroTitle,
    "Masaya gelen QR ile siparis surecini hizlandirin, servis kalitesini kontrollu sekilde buyutun.",
  );
  const heroDescription = textOr(
    data?.heroDescription,
    "CATAL APP; musteri, garson ve mutfak akislarini tek operasyonda birlestirerek restoraniniza hiz ve netlik kazandirir.",
  );
  const heroPrimaryLabel = textOr(data?.heroPrimaryCtaLabel, "Demo Talep Et");
  const heroSecondaryLabel = textOr(data?.heroSecondaryCtaLabel, "Canli Onizleme");

  const announcementText = data?.announcementText?.trim() ?? "";
  const showAnnouncement = Boolean(data?.announcementEnabled && announcementText.length > 0);

  const heroBenefits = data ? buildHeroBenefits(data) : [];
  const businessSegments = data ? buildBusinessSegments(data) : [];
  const metricCards = data ? buildMetricCards(data) : [];
  const valueBlocks = data ? buildValueBlocks(data) : [];
  const howSteps = data ? buildHowSteps(data) : [];
  const useCaseCards = data ? buildUseCaseCards(data) : [];

  const logos = data?.logos ?? [];
  const faqs = data?.faqs ?? [];

  const showBusinessBand = businessSegments.length > 0;
  const showMetricSection = metricCards.length > 0;
  const showValueSection = valueBlocks.length > 0;
  const showHowSection = howSteps.length > 0;
  const showUseCases = useCaseCards.length > 0;
  const showFaqSection = faqs.length > 0;

  const trustTitle = textOr(data?.trustSectionTitle, "Sahada guvenle calisan ekiplerin tercihi");
  const trustDescription = textOr(
    data?.trustSectionDescription,
    "Canli operasyon odagi, mobil siparis deneyimi ve merkezi kontrol tek akis icinde bulusur.",
  );

  const featuresTitle = textOr(data?.featuresSectionTitle, "Operasyonu guclendiren urun katmanlari");
  const featuresDescription = textOr(
    data?.featuresSectionDescription,
    "QR siparis, ekip koordinasyonu ve yonetim kontrolunu tek bir satis motorunda birlestirin.",
  );

  const howTitle = textOr(data?.howItWorksSectionTitle, "Nasil calisir");
  const howDescription = textOr(
    data?.howItWorksSectionDescription,
    "Kurulum adimlari net oldugu icin ekip hizli adapte olur ve operasyon aksatmadan ilerler.",
  );

  const categoryTitle = textOr(data?.categorySectionTitle, "Kullanim alanlari");
  const categoryDescription = textOr(
    data?.categorySectionDescription,
    "Farkli servis modellerine uygun akislarla restoran tipinize en dogru kurguyu secin.",
  );

  const formTitle = textOr(data?.formSectionTitle, "Operasyonunuza uygun demo plani olusturalim");
  const formDescription = textOr(
    data?.formSectionDescription,
    "Kisa formu doldurun; ekip yapiniza ve servis modelinize uygun kurulum akisini birlikte netlestirelim.",
  );

  const ctaTitle = textOr(
    data?.ctaSectionTitle,
    "Restoraninizi hizlandiran operasyon modelini birlikte kuralim",
  );
  const ctaDescription = textOr(
    data?.ctaSectionDescription,
    "Canli bir gorusme ile mevcut akisinizdaki yavaslatan adimlari belirleyip net bir uygulama plani cikaralim.",
  );
  const ctaPrimaryLabel = textOr(data?.ctaPrimaryLabel, "Demo Randevusu Al");
  const ctaPrimaryHref = hrefOrFallback(data?.ctaPrimaryHref);

  return (
    <main className="marketing-surface marketing-backdrop relative min-h-screen overflow-hidden pb-14 text-[var(--ui-text-primary)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] marketing-grid-bg opacity-70" />

      {showAnnouncement ? (
        <section className="relative border-b border-[var(--ui-border-subtle)]/80 bg-[var(--ui-surface-bg)]/75">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-[var(--ui-text-secondary)] sm:px-6 lg:px-8">
            <p>{announcementText}</p>
            {hasText(data?.announcementCtaLabel) ? (
              <Link
                href={hrefOrFallback(data?.announcementCtaHref)}
                className="text-[var(--ui-accent)] hover:text-[var(--ui-text-primary)]"
              >
                {data?.announcementCtaLabel}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-[var(--ui-border-subtle)]/80 bg-[#070b12]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-base font-semibold tracking-tight text-white">{brandName}</p>
            <p className="hidden text-xs text-[var(--ui-text-muted)] sm:block">{brandTagline}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={hrefOrFallback(data?.heroSecondaryCtaHref)}
              className={buttonClasses({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
            >
              {heroSecondaryLabel}
            </Link>
            <Link
              href={hrefOrFallback(data?.heroPrimaryCtaHref)}
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
                href={hrefOrFallback(data?.heroPrimaryCtaHref)}
                className={buttonClasses({ variant: "primary", className: "w-full justify-center sm:w-auto" })}
              >
                {heroPrimaryLabel}
              </Link>
              <Link
                href={hrefOrFallback(data?.heroSecondaryCtaHref)}
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
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{formTitle}</h2>
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
                submitLabel={textOr(data?.formSubmitLabel, "Basvuru Gonder")}
                consentText={data?.formConsentText ?? null}
                trustBullets={heroBenefits}
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
              title={textOr(data?.faqSectionTitle, "Sik Sorulan Sorular")}
              description={data?.faqSectionDescription}
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
