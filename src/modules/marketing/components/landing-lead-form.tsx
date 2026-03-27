"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { MARKETING_UI } from "@/constants/marketing";
import { submitPublicContactFormAction } from "@/modules/marketing/actions/landing-form";
import { isValidTrMobile } from "@/modules/marketing/lib/tr-phone";

type LandingLeadFormProps = {
  submitLabel: string;
  consentText: string | null;
  successMessage?: string | null;
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

const landingContactSchema = z
  .object({
    firstName: z.string().min(1, "İsim zorunlu."),
    lastName: z.string().min(1, "Soyisim zorunlu."),
    phone: z.string().min(1, "Telefon zorunlu."),
    note: z.string().optional(),
    consent: z.boolean().refine((v) => v === true, { message: "Onay kutusu zorunludur." }),
    companyWebsite: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isValidTrMobile(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Geçerli bir Türkiye cep telefonu girin (örn. 05xx xxx xx xx).",
        path: ["phone"],
      });
    }
  });

type LandingContactValues = z.infer<typeof landingContactSchema>;

export function LandingLeadForm({
  submitLabel,
  consentText,
  successMessage,
  trustBullets,
  tracking,
}: LandingLeadFormProps) {
  const [serverMessage, setServerMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LandingContactValues>({
    resolver: zodResolver(landingContactSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      note: "",
      consent: false,
      companyWebsite: "",
    },
  });

  const onSubmit = async (values: LandingContactValues) => {
    setServerMessage(null);
    const fd = new FormData();
    fd.set("utmSource", tracking.utmSource);
    fd.set("utmMedium", tracking.utmMedium);
    fd.set("utmCampaign", tracking.utmCampaign);
    fd.set("utmTerm", tracking.utmTerm);
    fd.set("utmContent", tracking.utmContent);
    fd.set("landingPath", tracking.landingPath);
    fd.set("referrer", tracking.referrer);
    fd.set("firstName", values.firstName.trim());
    fd.set("lastName", values.lastName.trim());
    fd.set("phone", (values.phone ?? "").trim());
    fd.set("note", (values.note ?? "").trim());
    fd.set("consent", values.consent ? "on" : "");
    fd.set("companyWebsite", (values.companyWebsite ?? "").trim());

    const result = await submitPublicContactFormAction(fd);
    setServerMessage({ ok: result.ok, text: result.message });
    if (result.ok) {
      reset();
    }
  };

  const disabled = isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          <label className={labelClasses()} htmlFor="landing-firstName">
            İsim
          </label>
          <input
            id="landing-firstName"
            autoComplete="given-name"
            className={fieldClasses({ className: "min-h-11 rounded-xl" })}
            disabled={disabled}
            {...register("firstName")}
          />
          {errors.firstName ? (
            <p className="text-xs text-[color:var(--ui-danger)]">{errors.firstName.message}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <label className={labelClasses()} htmlFor="landing-lastName">
            Soyisim
          </label>
          <input
            id="landing-lastName"
            autoComplete="family-name"
            className={fieldClasses({ className: "min-h-11 rounded-xl" })}
            disabled={disabled}
            {...register("lastName")}
          />
          {errors.lastName ? (
            <p className="text-xs text-[color:var(--ui-danger)]">{errors.lastName.message}</p>
          ) : null}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()} htmlFor="landing-phone">
            Telefon
          </label>
          <input
            id="landing-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            className={fieldClasses({ className: "min-h-11 rounded-xl" })}
            disabled={disabled}
            placeholder="05xx xxx xx xx"
            {...register("phone")}
          />
          {errors.phone ? (
            <p className="text-xs text-[color:var(--ui-danger)]">{errors.phone.message}</p>
          ) : null}
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()} htmlFor="landing-note">
            Not <span className="font-normal text-[var(--ui-text-muted)]">(isteğe bağlı)</span>
          </label>
          <textarea
            id="landing-note"
            className={textareaClasses({ className: "min-h-[96px] rounded-xl" })}
            disabled={disabled}
            placeholder="Kısa notunuzu yazabilirsiniz."
            {...register("note")}
          />
        </div>
      </div>

      <div aria-hidden className="hidden">
        <label htmlFor="landing-companyWebsite">Website</label>
        <input id="landing-companyWebsite" tabIndex={-1} autoComplete="off" {...register("companyWebsite")} />
      </div>

      <label className="flex min-h-11 items-start gap-2 rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/55 px-3 py-2.5 text-sm text-[var(--ui-text-secondary)]">
        <input type="checkbox" className={checkboxInputClasses()} disabled={disabled} {...register("consent")} />
        <span>
          {consentText ??
            "Bilgilerimin satış ekibi tarafından iletişim için kullanılmasını kabul ediyorum."}
        </span>
      </label>
      {errors.consent ? (
        <p className="text-xs text-[color:var(--ui-danger)]">{errors.consent.message}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={disabled}
          className={buttonClasses({
            variant: "primary",
            className: "min-h-11 w-full justify-center rounded-xl text-sm font-semibold",
          })}
        >
          {isSubmitting ? "Gönderiliyor..." : submitLabel}
        </button>
        <p className="text-xs text-[var(--ui-text-muted)]">{MARKETING_UI.formFooterHint}</p>
        {serverMessage?.text ? (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              serverMessage.ok
                ? "border-[color:var(--ui-success-border)] bg-[color:var(--ui-success-soft)] text-[color:var(--ui-success)]"
                : "border-[color:var(--ui-danger-border)] bg-[color:var(--ui-danger-soft)] text-[color:var(--ui-danger)]"
            }`}
            role="status"
          >
            {serverMessage.ok && successMessage ? successMessage : serverMessage.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
