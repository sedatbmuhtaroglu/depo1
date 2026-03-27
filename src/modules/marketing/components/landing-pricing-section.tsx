"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { LandingPublicPricing } from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";

type Billing = "monthly" | "yearly";

type Props = {
  pricing: LandingPublicPricing;
};

export function LandingPricingSection({ pricing }: Props) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const showToggle = pricing.billingToggleEnabled;

  return (
    <section id={pricing.sectionId} className="marketing-section-y bg-[var(--landing-surface)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="marketing-section-eyebrow mb-2">{pricing.eyebrow}</p>
          <h2 className="marketing-heading-serif text-2xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-3xl md:text-[2rem]">
            {pricing.title}
          </h2>
          <p className="marketing-section-lede mt-3">{pricing.description}</p>
          <p className="mt-4 text-xs font-medium text-[var(--landing-text-muted)]">
            {pricing.microTrust.join(" · ")}
          </p>

          {showToggle ? (
            <div className="mt-8 flex flex-col items-center gap-2">
              <div
                className="inline-flex rounded-full border border-[var(--landing-border)] bg-[color-mix(in_srgb,var(--landing-card)_88%,var(--landing-surface))] p-1 shadow-[var(--landing-shadow-soft)]"
                role="group"
                aria-label="Faturalandırma dönemi"
              >
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                    billing === "monthly"
                      ? "bg-[var(--landing-card)] text-[var(--landing-text-primary)] shadow-sm ring-1 ring-[var(--landing-border)]"
                      : "text-[var(--landing-text-secondary)] hover:text-[var(--landing-text-primary)]"
                  }`}
                >
                  {pricing.billingMonthlyLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("yearly")}
                  className={`relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                    billing === "yearly"
                      ? "bg-[var(--landing-card)] text-[var(--landing-text-primary)] shadow-sm ring-1 ring-[var(--landing-border)]"
                      : "text-[var(--landing-text-secondary)] hover:text-[var(--landing-text-primary)]"
                  }`}
                >
                  {pricing.billingYearlyLabel}
                  {pricing.billingYearlyHint.trim() ? (
                    <span className="rounded-full bg-[var(--landing-accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--landing-accent)]">
                      {pricing.billingYearlyHint.trim()}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {pricing.plans.map((plan) => {
            const price = billing === "monthly" ? plan.priceMonthly : plan.priceYearly;
            const period = billing === "monthly" ? plan.periodMonthly : plan.periodYearly;
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-[var(--landing-radius-lg)] border p-6 transition-[box-shadow,transform] duration-200 sm:p-7 ${
                  plan.highlighted
                    ? "border-[var(--landing-accent)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-card)] ring-1 ring-[var(--landing-accent-soft)] lg:-translate-y-0.5"
                    : "border-[var(--landing-border)] bg-[var(--landing-card)] shadow-[var(--landing-shadow-soft)] hover:border-[color-mix(in_srgb,var(--landing-border-strong)_70%,transparent)] hover:shadow-[var(--landing-shadow-card)]"
                }`}
              >
                {plan.badge.trim() ? (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--landing-accent)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                    {plan.badge.trim()}
                  </span>
                ) : null}
                <div className="min-h-[3.5rem]">
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--landing-text-primary)]">
                    {plan.name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--landing-text-muted)]">
                    {plan.description}
                  </p>
                </div>
                <div className="mt-6 border-t border-[var(--landing-border)] pt-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-[2rem] font-bold leading-none tracking-tight text-[var(--landing-text-primary)] sm:text-[2.25rem]">
                      {price}
                    </span>
                  </div>
                  {period.trim() ? (
                    <p className="mt-2 text-sm font-medium text-[var(--landing-text-secondary)]">{period}</p>
                  ) : null}
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm leading-snug text-[var(--landing-text-secondary)]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--landing-accent-soft)] text-[var(--landing-accent)]">
                        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.cta.href}
                  className={
                    plan.highlighted
                      ? buttonClasses({
                          variant: "primary",
                          className:
                            "mt-8 flex min-h-11 w-full justify-center rounded-[var(--landing-radius-md)] font-semibold",
                        })
                      : buttonClasses({
                          variant: "outline",
                          className:
                            "mt-8 flex min-h-11 w-full justify-center rounded-[var(--landing-radius-md)] border-[var(--landing-border-strong)] font-medium",
                        })
                  }
                >
                  {plan.cta.label}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
