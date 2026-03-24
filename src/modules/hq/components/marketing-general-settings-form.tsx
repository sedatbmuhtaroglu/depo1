"use client";

import { useActionState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { saveMarketingGeneralSettingsAction } from "@/modules/hq/actions/marketing";
import type { MarketingLandingHqData } from "@/modules/marketing/server/landing-content";

type MarketingGeneralSettingsFormProps = {
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

export function MarketingGeneralSettingsForm({ site }: MarketingGeneralSettingsFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveMarketingGeneralSettingsAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Marka Adi</label>
          <input name="brandName" defaultValue={site.brandName} className={fieldClasses()} required />
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Marka Tagline</label>
          <input
            name="brandTagline"
            defaultValue={site.brandTagline ?? ""}
            className={fieldClasses()}
            placeholder="Kisa deger onermesi"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)] md:col-span-2">
          <input
            name="isPublished"
            type="checkbox"
            className={checkboxInputClasses()}
            defaultChecked={site.isPublished}
            value="true"
          />
          Landing yayinda olsun
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>SEO Title</label>
          <input name="seoTitle" defaultValue={site.seoTitle ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>SEO Description</label>
          <textarea
            name="seoDescription"
            defaultValue={site.seoDescription ?? ""}
            className={textareaClasses({ className: "min-h-[96px]" })}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Canonical URL</label>
          <input
            name="seoCanonicalUrl"
            defaultValue={site.seoCanonicalUrl ?? ""}
            className={fieldClasses()}
            placeholder="https://www.ornek.com/"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>OG Image URL</label>
          <input name="seoOgImageUrl" defaultValue={site.seoOgImageUrl ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>OG Title</label>
          <input name="seoOgTitle" defaultValue={site.seoOgTitle ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>OG Description</label>
          <input name="seoOgDescription" defaultValue={site.seoOgDescription ?? ""} className={fieldClasses()} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Genel Ayarlari Kaydet"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
