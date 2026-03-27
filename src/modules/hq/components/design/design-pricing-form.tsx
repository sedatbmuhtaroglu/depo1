"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveLandingDesignPricingAction } from "@/modules/hq/actions/landing-design";
import type {
  LandingPublicPricing,
  LandingPublicPricingPlan,
} from "@/modules/marketing/landing-public-design";
import { buttonClasses, fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { DesignSaveFeedback } from "@/modules/hq/components/design/design-save-feedback";

type Props = {
  initial: LandingPublicPricing;
};

function newPlan(): LandingPublicPricingPlan {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `plan-${Date.now()}`,
    name: "Yeni paket",
    priceMonthly: "Teklif",
    periodMonthly: "",
    priceYearly: "Teklif",
    periodYearly: "",
    description: "",
    features: ["Özellik satırı"],
    cta: { label: "Bilgi al", href: "#lead-form" },
    highlighted: false,
    badge: "",
  };
}

export function DesignPricingForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(saveLandingDesignPricingAction, undefined);
  const [pricing, setPricing] = useState<LandingPublicPricing>(() => ({
    ...initial,
    plans: initial.plans.map((p) => ({ ...p })),
    microTrust: [...initial.microTrust],
  }));

  function setSection(
    patch: Partial<
      Pick<
        LandingPublicPricing,
        | "sectionId"
        | "eyebrow"
        | "title"
        | "description"
        | "billingToggleEnabled"
        | "billingMonthlyLabel"
        | "billingYearlyLabel"
        | "billingYearlyHint"
      >
    >,
  ) {
    setPricing((p) => ({ ...p, ...patch }));
  }

  function setMicroTrustText(text: string) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 1 && lines[0] === "") {
      setPricing((p) => ({ ...p, microTrust: [] }));
      return;
    }
    setPricing((p) => ({ ...p, microTrust: lines }));
  }

  function movePlan(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= pricing.plans.length) return;
    setPricing((p) => {
      const copy = [...p.plans];
      const t = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = t;
      return { ...p, plans: copy };
    });
  }

  function updatePlan(index: number, patch: Partial<LandingPublicPricingPlan>) {
    setPricing((p) => {
      const plans = p.plans.map((pl, i) => {
        if (patch.highlighted === true) {
          if (i === index) return { ...pl, ...patch };
          return { ...pl, highlighted: false };
        }
        if (i === index) return { ...pl, ...patch };
        return pl;
      });
      return { ...p, plans };
    });
  }

  function setPlanFeatures(index: number, text: string) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 1 && lines[0] === "") {
      updatePlan(index, { features: ["—"] });
      return;
    }
    updatePlan(index, { features: lines });
  }

  function removePlan(index: number) {
    setPricing((p) => ({
      ...p,
      plans: p.plans.filter((_, i) => i !== index),
    }));
  }

  function addPlan() {
    setPricing((p) => ({ ...p, plans: [...p.plans, newPlan()] }));
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("pricingPayload", JSON.stringify(pricing));
        void formAction(fd);
      }}
    >
      <DesignSaveFeedback state={state} />

      <div className="space-y-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-4">
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Bölüm başlığı</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClasses()} htmlFor="sectionId">
              Bölüm kimliği (anchor)
            </label>
            <input
              id="sectionId"
              value={pricing.sectionId}
              onChange={(e) => setSection({ sectionId: e.target.value })}
              className={fieldClasses({ className: "w-full max-w-md font-mono text-sm" })}
              placeholder="fiyat"
            />
            <p className="text-xs text-[var(--ui-text-muted)]">
              Üst menüdeki <code className="rounded bg-[var(--ui-surface-subtle)] px-1">#…</code> hedefi ile aynı olmalı
              (ör. <code className="rounded bg-[var(--ui-surface-subtle)] px-1">#fiyat</code>).
            </p>
          </div>
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="eyebrow">
              Üst etiket
            </label>
            <input
              id="eyebrow"
              value={pricing.eyebrow}
              onChange={(e) => setSection({ eyebrow: e.target.value })}
              className={fieldClasses({ className: "w-full" })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClasses()} htmlFor="title">
              Başlık
            </label>
            <input
              id="title"
              value={pricing.title}
              onChange={(e) => setSection({ title: e.target.value })}
              className={fieldClasses({ className: "w-full" })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClasses()} htmlFor="description">
              Açıklama
            </label>
            <textarea
              id="description"
              value={pricing.description}
              onChange={(e) => setSection({ description: e.target.value })}
              rows={3}
              className={fieldClasses({ className: "w-full resize-y min-h-[4rem]" })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClasses()} htmlFor="microTrust">
              Alt güven satırı (her satır bir öğe, arada · ile birleştirilir)
            </label>
            <textarea
              id="microTrust"
              value={pricing.microTrust.join("\n")}
              onChange={(e) => setMicroTrustText(e.target.value)}
              rows={4}
              className={fieldClasses({ className: "w-full resize-y font-mono text-sm" })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-4">
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Aylık / yıllık seçici</h3>
        <p className="text-xs text-[var(--ui-text-muted)]">
          Ziyaretçiler ana sayfada dönem seçebilir. Kapatırsanız yalnızca aylık fiyatlar gösterilir.
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pricing.billingToggleEnabled}
            onChange={(e) => setSection({ billingToggleEnabled: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          Aylık ve yıllık seçimini göster
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="billingMonthlyLabel">
              Aylık sekme metni
            </label>
            <input
              id="billingMonthlyLabel"
              value={pricing.billingMonthlyLabel}
              onChange={(e) => setSection({ billingMonthlyLabel: e.target.value })}
              className={fieldClasses({ className: "w-full" })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="billingYearlyLabel">
              Yıllık sekme metni
            </label>
            <input
              id="billingYearlyLabel"
              value={pricing.billingYearlyLabel}
              onChange={(e) => setSection({ billingYearlyLabel: e.target.value })}
              className={fieldClasses({ className: "w-full" })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="billingYearlyHint">
              Yıllık rozet (isteğe bağlı)
            </label>
            <input
              id="billingYearlyHint"
              value={pricing.billingYearlyHint}
              onChange={(e) => setSection({ billingYearlyHint: e.target.value })}
              className={fieldClasses({ className: "w-full" })}
              placeholder="Örn. 2 ay bedava"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Paket kartları</h3>
          <button
            type="button"
            onClick={addPlan}
            className={buttonClasses({
              variant: "outline",
              className: "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm",
            })}
          >
            <Plus className="h-4 w-4" />
            Paket ekle
          </button>
        </div>

        <ul className="space-y-4">
          {pricing.plans.map((plan, index) => (
            <li
              key={plan.id}
              className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--ui-text-muted)]">Paket {index + 1}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)]"
                    onClick={() => movePlan(index, -1)}
                    disabled={index === 0}
                    aria-label="Yukarı taşı"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)]"
                    onClick={() => movePlan(index, 1)}
                    disabled={index === pricing.plans.length - 1}
                    aria-label="Aşağı taşı"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                    onClick={() => removePlan(index)}
                    disabled={pricing.plans.length <= 1}
                    aria-label="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className={labelClasses()}>Paket adı</label>
                  <input
                    className={fieldClasses({ className: "w-full" })}
                    value={plan.name}
                    onChange={(e) => updatePlan(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-medium text-[var(--ui-text-muted)]">Aylık fiyatlandırma</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className={labelClasses()}>Fiyat</label>
                      <input
                        className={fieldClasses({ className: "w-full" })}
                        value={plan.priceMonthly}
                        onChange={(e) => updatePlan(index, { priceMonthly: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses()}>Dönem notu</label>
                      <input
                        className={fieldClasses({ className: "w-full" })}
                        value={plan.periodMonthly}
                        onChange={(e) => updatePlan(index, { periodMonthly: e.target.value })}
                        placeholder="/ ay / işletmeye göre"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-medium text-[var(--ui-text-muted)]">Yıllık fiyatlandırma</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className={labelClasses()}>Fiyat</label>
                      <input
                        className={fieldClasses({ className: "w-full" })}
                        value={plan.priceYearly}
                        onChange={(e) => updatePlan(index, { priceYearly: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={labelClasses()}>Dönem notu</label>
                      <input
                        className={fieldClasses({ className: "w-full" })}
                        value={plan.periodYearly}
                        onChange={(e) => updatePlan(index, { periodYearly: e.target.value })}
                        placeholder="/ yıl"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className={labelClasses()}>Kısa açıklama</label>
                  <textarea
                    className={fieldClasses({ className: "w-full resize-y min-h-[3rem]" })}
                    value={plan.description}
                    onChange={(e) => updatePlan(index, { description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className={labelClasses()}>Özellikler (her satır bir madde)</label>
                  <textarea
                    className={fieldClasses({ className: "w-full resize-y font-mono text-sm min-h-[6rem]" })}
                    value={plan.features.join("\n")}
                    onChange={(e) => setPlanFeatures(index, e.target.value)}
                    rows={6}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClasses()}>CTA metni</label>
                  <input
                    className={fieldClasses({ className: "w-full" })}
                    value={plan.cta.label}
                    onChange={(e) =>
                      updatePlan(index, { cta: { ...plan.cta, label: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClasses()}>CTA bağlantısı</label>
                  <input
                    className={fieldClasses({ className: "w-full font-mono text-sm" })}
                    value={plan.cta.href}
                    onChange={(e) =>
                      updatePlan(index, { cta: { ...plan.cta, href: e.target.value } })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={plan.highlighted}
                    onChange={(e) => updatePlan(index, { highlighted: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  Önerilen paket (vurgulu kart + turuncu çerçeve)
                </label>
                <div className="space-y-1 sm:col-span-2">
                  <label className={labelClasses()}>Rozet metni (önerilen kartta üstte)</label>
                  <input
                    className={fieldClasses({ className: "w-full max-w-xs" })}
                    value={plan.badge}
                    onChange={(e) => updatePlan(index, { badge: e.target.value })}
                    placeholder="Önerilen"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses({ variant: "primary", className: "rounded-lg px-5" })}
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
