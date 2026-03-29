import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  landingBenefits,
  landingFaq,
  landingFinalCta,
  landingFooter,
  landingHero,
  landingHowItWorks,
  landingLeadForm,
  landingTrustStrip,
  landingUseCases,
} from "@/content/landing";
import type { MergedPublicLandingDesign } from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";
import { LandingLeadForm } from "@/modules/marketing/components/landing-lead-form";
import { LandingPricingSection } from "@/modules/marketing/components/landing-pricing-section";
import { marketingLandingFontClassName } from "@/modules/marketing/marketing-fonts";

type LandingHomepageViewProps = {
  design: MergedPublicLandingDesign;
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

function landingSurfaceStyle(d: MergedPublicLandingDesign): CSSProperties {
  const { colors } = d;
  return {
    ["--landing-accent" as string]: colors.primaryBg,
    ["--landing-accent-hover" as string]: colors.primaryHoverBg,
    ["--landing-accent-soft" as string]: `color-mix(in srgb, ${colors.primaryBg} 14%, transparent)`,
    ["--landing-button-primary-bg" as string]: colors.primaryBg,
    ["--landing-button-primary-text" as string]: colors.primaryFg,
    ["--btn-primary-bg" as string]: colors.primaryBg,
    ["--btn-primary-bg-hover" as string]: colors.primaryHoverBg,
    ["--btn-primary-fg" as string]: colors.primaryFg,
    ["--ui-primary" as string]: colors.primaryBg,
    ["--ui-primary-hover" as string]: colors.primaryHoverBg,
    ["--ui-accent" as string]: colors.primaryBg,
    ["--landing-cta-outline-fg" as string]: colors.outlineFg,
    ["--landing-cta-outline-border" as string]: colors.outlineBorder,
    ["--landing-cta-outline-hover-bg" as string]: colors.outlineHoverBg,
  };
}

function SectionShell({
  id,
  className = "",
  children,
  surface = "default",
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  surface?: "default" | "muted" | "dark";
}) {
  const surfaceClass =
    surface === "muted"
      ? "bg-[var(--landing-surface)]"
      : surface === "dark"
        ? "bg-[var(--landing-ink)] text-[var(--landing-ink-fg)]"
        : "bg-[var(--landing-background)]";

  return (
    <section id={id} className={`marketing-section-y ${surfaceClass} ${className}`.trim()}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div
      className="relative mx-auto w-full max-w-[320px] sm:max-w-[380px]"
      aria-hidden
    >
      <div className="rounded-[2rem] border border-[var(--landing-border-strong)] bg-[var(--landing-card)] p-3 shadow-[var(--landing-shadow-card)]">
        <div className="overflow-hidden rounded-[1.35rem] bg-[var(--landing-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--landing-border)] px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--landing-text-secondary)]">
              Canlı menü
            </span>
            <span className="h-2 w-12 rounded-full bg-[var(--landing-border)]" />
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-3">
              <div className="h-14 w-14 shrink-0 rounded-lg bg-[var(--landing-surface)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2 w-[75%] rounded bg-[var(--landing-border)]" />
                <div className="h-2 w-[50%] rounded bg-[var(--landing-border)]" />
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-3">
              <div className="h-14 w-14 shrink-0 rounded-lg bg-[var(--landing-surface)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-2 w-[66%] rounded bg-[var(--landing-border)]" />
                <div className="h-2 w-[42%] rounded bg-[var(--landing-border)]" />
              </div>
            </div>
            <div className="rounded-xl bg-[var(--landing-accent)] px-4 py-3 text-center text-sm font-semibold text-white">
              Masaya sipariş gönder
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHomepageView({ design, tracking }: LandingHomepageViewProps) {
  const { general: g, nav: navItems, headerBarCta, heroPrimary, heroSecondary, pricing: landingPricing } =
    design;

  const outlineBtnClass =
    "inline-flex min-h-12 justify-center rounded-[var(--landing-radius-md)] border px-6 text-base font-medium transition-colors border-[color:var(--landing-cta-outline-border)] bg-[var(--landing-card)] text-[color:var(--landing-cta-outline-fg)] hover:bg-[color:var(--landing-cta-outline-hover-bg)]";

  return (
    <div
      className={`marketing-surface ${marketingLandingFontClassName} min-h-screen bg-[var(--landing-background)] text-[var(--landing-text-primary)] antialiased`}
      style={landingSurfaceStyle(design)}
    >
      <a
        href="#lead-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--landing-card)] focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Forma geç
      </a>

      <header className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-background)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-base font-semibold tracking-tight text-[var(--landing-text-primary)]">
              {g.brandName}
            </span>
            {g.showTaglineInHeader ? (
              <span className="hidden text-xs text-[var(--landing-text-muted)] sm:inline">
                {g.brandTagline}
              </span>
            ) : null}
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Sayfa bölümleri"
          >
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--landing-text-secondary)] transition-colors hover:bg-[var(--landing-surface)] hover:text-[var(--landing-text-primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {headerBarCta.enabled ? (
              <Link
                href={headerBarCta.href}
                className={buttonClasses({
                  variant: "primary",
                  className:
                    "rounded-[var(--landing-radius-md)] px-4 py-2.5 text-sm font-semibold shadow-none",
                })}
              >
                {headerBarCta.label}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="border-t border-[var(--landing-border)] px-2 py-2 md:hidden">
          <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-[var(--landing-border)] bg-[var(--landing-card)] px-3 py-1.5 text-xs font-medium text-[var(--landing-text-secondary)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <SectionShell className="pt-8 sm:pt-12">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:gap-14">
            <div className="max-w-xl">
              <p className="marketing-section-eyebrow mb-3">{landingHero.eyebrow}</p>
              <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--landing-text-primary)] sm:text-[2.125rem] md:text-[2.5rem]">
                {landingHero.title}
              </h1>
              <p className="marketing-section-lede mt-4 max-w-[40ch] text-[var(--landing-text-secondary)]">
                {landingHero.description}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {heroPrimary.enabled ? (
                  <Link
                    href={heroPrimary.href}
                    className={buttonClasses({
                      variant: "primary",
                      className:
                        "inline-flex min-h-12 justify-center rounded-[var(--landing-radius-md)] px-6 text-base font-semibold",
                    })}
                  >
                    {heroPrimary.label}
                  </Link>
                ) : null}
                {heroSecondary.enabled ? (
                  <Link href={heroSecondary.href} className={outlineBtnClass}>
                    {heroSecondary.label}
                  </Link>
                ) : null}
              </div>
              <p className="mt-5 max-w-md text-sm text-[var(--landing-text-muted)]">{landingHero.trustLine}</p>
            </div>
            <HeroMockup />
          </div>
        </SectionShell>

        {/* Trust strip */}
        <SectionShell surface="muted">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {landingTrustStrip.items.map((item) => (
              <div
                key={item.label}
                className="marketing-card-surface flex flex-col gap-1 rounded-[var(--landing-radius-md)] border border-[var(--marketing-card-border)] bg-[var(--landing-card)] p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-[var(--landing-text-primary)]">{item.label}</p>
                <p className="text-xs leading-relaxed text-[var(--landing-text-muted)]">{item.hint}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* Benefits */}
        <SectionShell id={landingBenefits.id}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="marketing-section-eyebrow mb-2">{landingBenefits.eyebrow}</p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-3xl">
              {landingBenefits.title}
            </h2>
            <p className="marketing-section-lede mt-3">{landingBenefits.description}</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {landingBenefits.cards.map((card) => (
              <article
                key={card.title}
                className="marketing-card-surface flex flex-col gap-3 rounded-[var(--landing-radius-lg)] border border-[var(--marketing-card-border)] bg-[var(--landing-card)] p-6 shadow-[var(--landing-shadow-soft)]"
              >
                <h3 className="text-lg font-semibold text-[var(--landing-text-primary)]">{card.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--landing-text-secondary)]">{card.body}</p>
              </article>
            ))}
          </div>
        </SectionShell>

        {/* How it works */}
        <SectionShell id={landingHowItWorks.id} surface="muted">
          <div className="mx-auto max-w-2xl text-center">
            <p className="marketing-section-eyebrow mb-2">{landingHowItWorks.eyebrow}</p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-3xl">
              {landingHowItWorks.title}
            </h2>
            <p className="marketing-section-lede mt-3">{landingHowItWorks.description}</p>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {landingHowItWorks.steps.map((s) => (
              <li
                key={s.step}
                className="relative rounded-[var(--landing-radius-lg)] border border-[var(--landing-border)] bg-[var(--landing-card)] p-6"
              >
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--landing-accent-soft)] text-sm font-bold text-[var(--landing-accent)]">
                  {s.step}
                </span>
                <h3 className="text-base font-semibold text-[var(--landing-text-primary)]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-text-secondary)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </SectionShell>

        {/* Use cases */}
        <SectionShell id={landingUseCases.id}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="marketing-section-eyebrow mb-2">{landingUseCases.eyebrow}</p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-3xl">
              {landingUseCases.title}
            </h2>
            <p className="marketing-section-lede mt-3">{landingUseCases.description}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {landingUseCases.cases.map((c) => (
              <div
                key={c.title}
                className="rounded-[var(--landing-radius-md)] border border-[var(--landing-border)] bg-[var(--landing-surface)] p-5"
              >
                <h3 className="text-base font-semibold text-[var(--landing-text-primary)]">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-text-secondary)]">{c.body}</p>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* Pricing */}
        <LandingPricingSection pricing={landingPricing} />

        {/* FAQ */}
        <SectionShell id={landingFaq.id}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="marketing-section-eyebrow mb-2">{landingFaq.eyebrow}</p>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-3xl">
              {landingFaq.title}
            </h2>
            <p className="marketing-section-lede mt-3">{landingFaq.description}</p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {landingFaq.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-[var(--landing-radius-md)] border border-[var(--landing-border)] bg-[var(--landing-card)] px-4 py-3 transition-colors open:bg-[var(--landing-surface)]"
              >
                <summary className="cursor-pointer list-none text-left text-sm font-semibold text-[var(--landing-text-primary)] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {item.q}
                    <span className="mt-0.5 text-[var(--landing-accent)] transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </span>
                </summary>
                <p className="mt-3 border-t border-[var(--landing-border)] pt-3 text-sm leading-relaxed text-[var(--landing-text-secondary)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </SectionShell>

        {/* Final CTA */}
        <SectionShell surface="dark">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-ink-fg)] sm:text-3xl">
              {landingFinalCta.title}
            </h2>
            <p className="mt-3 text-base text-[color-mix(in_srgb,var(--landing-ink-fg)_78%,transparent)]">
              {landingFinalCta.description}
            </p>
            <Link
              href={landingFinalCta.primaryCta.href}
              className={buttonClasses({
                variant: "primary",
                className:
                  "mt-8 inline-flex min-h-12 justify-center rounded-[var(--landing-radius-md)] px-8 text-base font-semibold",
              })}
            >
              {landingFinalCta.primaryCta.label}
            </Link>
          </div>
        </SectionShell>

        {/* Lead form */}
        <SectionShell id={landingLeadForm.sectionId} surface="muted">
          <div className="mx-auto max-w-xl">
            <div className="text-center">
              <p className="marketing-section-eyebrow mb-2">{landingLeadForm.eyebrow}</p>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--landing-text-primary)]">
                {landingLeadForm.title}
              </h2>
              <p className="marketing-section-lede mt-3">{landingLeadForm.description}</p>
            </div>
            <div className="marketing-card-surface mt-10 rounded-[var(--landing-radius-lg)] border border-[var(--marketing-card-border)] bg-[var(--landing-card)] p-6 sm:p-8">
              <LandingLeadForm
                submitLabel={landingLeadForm.submitLabel}
                consentText={landingLeadForm.consentText}
                successMessage={landingLeadForm.successMessage}
                trustBullets={[...landingLeadForm.trustBullets]}
                tracking={tracking}
              />
            </div>
          </div>
        </SectionShell>

        {/* Footer */}
        <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-background)] py-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
            <div>
              <p className="text-base font-semibold text-[var(--landing-text-primary)]">{landingFooter.brand}</p>
              <p className="mt-1 max-w-sm text-sm text-[var(--landing-text-secondary)]">{landingFooter.tagline}</p>
              <p className="mt-4 text-xs text-[var(--landing-text-muted)]">{landingFooter.note}</p>
            </div>
            <nav className="flex flex-wrap gap-4 text-sm font-medium" aria-label="Alt bağlantılar">
              {landingFooter.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[var(--landing-text-secondary)] transition-colors hover:text-[var(--landing-accent)]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </main>
    </div>
  );
}
