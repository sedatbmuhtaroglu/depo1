"use client";

import { useMemo } from "react";
import { useActionState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { saveMarketingHomepageContentAction } from "@/modules/hq/actions/marketing";
import type { MarketingLandingHqData } from "@/modules/marketing/server/landing-content";

type MarketingHomepageContentFormProps = {
  site: MarketingLandingHqData;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function MarketingHomepageContentForm({ site }: MarketingHomepageContentFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveMarketingHomepageContentAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  const trustBadgeLines = useMemo(
    () =>
      site.trustBadges
        .map((item) => [item.label, item.sublabel ?? "", item.iconName ?? ""].join("|"))
        .join("\n"),
    [site.trustBadges],
  );
  const logoLines = useMemo(
    () =>
      site.logos
        .map((item) => [item.name, item.logoUrl, item.targetUrl ?? ""].join("|"))
        .join("\n"),
    [site.logos],
  );
  const featureLines = useMemo(
    () =>
      site.features
        .map((item) =>
          [item.title, item.description, item.iconName ?? "", item.ctaLabel ?? "", item.ctaHref ?? ""].join("|"),
        )
        .join("\n"),
    [site.features],
  );
  const howLines = useMemo(
    () => site.howItWorks.map((item) => [item.title, item.description].join("|")).join("\n"),
    [site.howItWorks],
  );
  const faqLines = useMemo(
    () => site.faqs.map((item) => [item.question, item.answer].join("|")).join("\n"),
    [site.faqs],
  );

  return (
    <form action={action} className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)] md:col-span-2">
          <input
            name="announcementEnabled"
            type="checkbox"
            value="true"
            defaultChecked={site.announcementEnabled}
            className={checkboxInputClasses()}
          />
          Announcement bar aktif
        </label>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Announcement Metni</label>
          <input
            name="announcementText"
            defaultValue={site.announcementText ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Announcement CTA Label</label>
          <input
            name="announcementCtaLabel"
            defaultValue={site.announcementCtaLabel ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Announcement CTA Href</label>
          <input
            name="announcementCtaHref"
            defaultValue={site.announcementCtaHref ?? ""}
            className={fieldClasses()}
            placeholder="#lead-form"
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Hero Kicker</label>
          <input name="heroKicker" defaultValue={site.heroKicker ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Hero Baslik</label>
          <input name="heroTitle" defaultValue={site.heroTitle} className={fieldClasses()} required />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Hero Aciklama</label>
          <textarea
            name="heroDescription"
            defaultValue={site.heroDescription}
            className={textareaClasses({ className: "min-h-[110px]" })}
            required
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Hero Birincil CTA Label</label>
          <input
            name="heroPrimaryCtaLabel"
            defaultValue={site.heroPrimaryCtaLabel}
            className={fieldClasses()}
            required
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Hero Birincil CTA Href</label>
          <input
            name="heroPrimaryCtaHref"
            defaultValue={site.heroPrimaryCtaHref}
            className={fieldClasses()}
            required
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Hero Ikincil CTA Label</label>
          <input
            name="heroSecondaryCtaLabel"
            defaultValue={site.heroSecondaryCtaLabel ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Hero Ikincil CTA Href</label>
          <input
            name="heroSecondaryCtaHref"
            defaultValue={site.heroSecondaryCtaHref ?? ""}
            className={fieldClasses()}
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Trust Section Baslik</label>
          <input name="trustSectionTitle" defaultValue={site.trustSectionTitle ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Trust Section Aciklama</label>
          <input
            name="trustSectionDescription"
            defaultValue={site.trustSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Features Baslik</label>
          <input
            name="featuresSectionTitle"
            defaultValue={site.featuresSectionTitle ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Features Aciklama</label>
          <input
            name="featuresSectionDescription"
            defaultValue={site.featuresSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>How It Works Baslik</label>
          <input
            name="howItWorksSectionTitle"
            defaultValue={site.howItWorksSectionTitle ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>How It Works Aciklama</label>
          <input
            name="howItWorksSectionDescription"
            defaultValue={site.howItWorksSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kategori Baslik</label>
          <input
            name="categorySectionTitle"
            defaultValue={site.categorySectionTitle ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kategori Aciklama</label>
          <input
            name="categorySectionDescription"
            defaultValue={site.categorySectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kapanis CTA Baslik</label>
          <input name="ctaSectionTitle" defaultValue={site.ctaSectionTitle ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kapanis CTA Aciklama</label>
          <input
            name="ctaSectionDescription"
            defaultValue={site.ctaSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kapanis CTA Buton Metni</label>
          <input name="ctaPrimaryLabel" defaultValue={site.ctaPrimaryLabel ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kapanis CTA Buton Linki</label>
          <input name="ctaPrimaryHref" defaultValue={site.ctaPrimaryHref ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>FAQ Baslik</label>
          <input name="faqSectionTitle" defaultValue={site.faqSectionTitle ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>FAQ Aciklama</label>
          <input
            name="faqSectionDescription"
            defaultValue={site.faqSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Form Baslik</label>
          <input name="formSectionTitle" defaultValue={site.formSectionTitle} className={fieldClasses()} required />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Form Aciklama</label>
          <input
            name="formSectionDescription"
            defaultValue={site.formSectionDescription ?? ""}
            className={fieldClasses()}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Form Buton Metni</label>
          <input name="formSubmitLabel" defaultValue={site.formSubmitLabel} className={fieldClasses()} required />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Form Onay Metni</label>
          <input name="formConsentText" defaultValue={site.formConsentText ?? ""} className={fieldClasses()} />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="space-y-1">
          <label className={labelClasses()}>Trust Badges Satirlari</label>
          <textarea
            name="trustBadgeLines"
            defaultValue={trustBadgeLines}
            className={textareaClasses({ className: "min-h-[120px]" })}
          />
          <p className="text-xs text-[var(--ui-text-secondary)]">Format: label|aciklama|iconName</p>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Logo Satirlari</label>
          <textarea
            name="logoLines"
            defaultValue={logoLines}
            className={textareaClasses({ className: "min-h-[120px]" })}
          />
          <p className="text-xs text-[var(--ui-text-secondary)]">Format: name|logoUrl|targetUrl</p>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Feature Satirlari</label>
          <textarea
            name="featureLines"
            defaultValue={featureLines}
            className={textareaClasses({ className: "min-h-[140px]" })}
          />
          <p className="text-xs text-[var(--ui-text-secondary)]">
            Format: baslik|aciklama|iconName|ctaLabel|ctaHref
          </p>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Nasil Calisir Satirlari</label>
          <textarea
            name="howItWorksLines"
            defaultValue={howLines}
            className={textareaClasses({ className: "min-h-[120px]" })}
          />
          <p className="text-xs text-[var(--ui-text-secondary)]">Format: baslik|aciklama</p>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>FAQ Satirlari</label>
          <textarea
            name="faqLines"
            defaultValue={faqLines}
            className={textareaClasses({ className: "min-h-[120px]" })}
          />
          <p className="text-xs text-[var(--ui-text-secondary)]">Format: soru|cevap</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Ana Sayfa Icerigini Kaydet"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
