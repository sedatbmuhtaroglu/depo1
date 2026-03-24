"use client";

import { useActionState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { submitLandingLeadFormAction } from "@/modules/marketing/actions/landing-form";

type LandingLeadFormProps = {
  submitLabel: string;
  consentText: string | null;
  trustBullets: string[];
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

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LandingLeadForm({
  submitLabel,
  consentText,
  trustBullets,
  tracking,
}: LandingLeadFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await submitLandingLeadFormAction(formData);
      return { ok: result.ok, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="sourceContext" value="LANDING_HOMEPAGE" />
      <input type="hidden" name="utmSource" value={tracking.utmSource} />
      <input type="hidden" name="utmMedium" value={tracking.utmMedium} />
      <input type="hidden" name="utmCampaign" value={tracking.utmCampaign} />
      <input type="hidden" name="utmTerm" value={tracking.utmTerm} />
      <input type="hidden" name="utmContent" value={tracking.utmContent} />
      <input type="hidden" name="landingPath" value={tracking.landingPath} />
      <input type="hidden" name="referrer" value={tracking.referrer} />

      <div aria-hidden className="hidden">
        <label>Website</label>
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </div>

      {trustBullets.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {trustBullets.slice(0, 2).map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/75 px-3 py-2 text-xs text-[var(--ui-text-secondary)]"
            >
              <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--ui-accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Iletisim Kisisi</label>
          <input
            name="contactName"
            className={fieldClasses({ className: "h-11 rounded-xl" })}
            required
            placeholder="Ad Soyad"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Isletme Adi</label>
          <input
            name="businessName"
            className={fieldClasses({ className: "h-11 rounded-xl" })}
            required
            placeholder="Restoran Adi"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Telefon</label>
          <input
            name="phone"
            className={fieldClasses({ className: "h-11 rounded-xl" })}
            placeholder="+90 5xx xxx xx xx"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>E-posta</label>
          <input
            name="email"
            className={fieldClasses({ className: "h-11 rounded-xl" })}
            placeholder="iletisim@ornek.com"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Sehir</label>
          <input
            name="city"
            className={fieldClasses({ className: "h-11 rounded-xl" })}
            placeholder="Istanbul"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Not</label>
          <textarea
            name="message"
            className={textareaClasses({ className: "min-h-[96px] rounded-xl" })}
            placeholder="Kisa notunuzu yazabilirsiniz."
          />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/55 px-3 py-2 text-sm text-[var(--ui-text-secondary)]">
        <input name="consent" type="checkbox" className={checkboxInputClasses()} required />
        <span>
          {consentText ??
            "Bilgilerimin satis ekibi tarafindan iletisim icin kullanilmasini kabul ediyorum."}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={buttonClasses({
            variant: "primary",
            className: "h-11 w-full justify-center rounded-xl text-sm font-semibold",
          })}
        >
          {isPending ? "Gonderiliyor..." : submitLabel}
        </button>
        <p className="text-xs text-[var(--ui-text-muted)]">
          Form 1 dakikadan kisa surer. Satis ekibi ayni gun geri donus yapar.
        </p>
        {state.message ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              state.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
