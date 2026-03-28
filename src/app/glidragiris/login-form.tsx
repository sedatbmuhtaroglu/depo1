"use client";

import Script from "next/script";
import { FormEvent, useActionState, useState, useTransition } from "react";
import { adminLogin } from "@/app/actions/admin-login";
import { executeRecaptchaV3, getRecaptchaSiteKey } from "@/lib/security/recaptcha-client";

export function LoginForm({ initialBannerError }: { initialBannerError?: string | null }) {
  const [state, formAction, isPending] = useActionState(adminLogin, undefined);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isRecaptchaPending, startRecaptchaTransition] = useTransition();
  const recaptchaSiteKey = getRecaptchaSiteKey();
  const bannerError = clientError ?? state?.error ?? initialBannerError;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    if (recaptchaSiteKey) {
      const recaptchaToken = await executeRecaptchaV3("admin_login_submit");
      if (!recaptchaToken) {
        setClientError("Güvenlik doğrulaması başarısız.");
        return;
      }
      formData.set("recaptchaToken", recaptchaToken);
    }

    startRecaptchaTransition(() => {
      void formAction(formData);
    });
  };

  return (
    <>
      {recaptchaSiteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`}
          strategy="afterInteractive"
        />
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="username" className="block text-sm font-medium text-neutral-700">
            Kullanıcı Adı
          </label>
          <input
            id="username"
            name="username"
            type="text"
            defaultValue="glidra"
            autoComplete="username"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-900"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
            Şifre
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-900"
          />
        </div>
        <input type="hidden" name="recaptchaToken" value="" />

        {bannerError ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {bannerError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending || isRecaptchaPending}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending || isRecaptchaPending ? "Giriş yapılıyor..." : "Yönetici girişi"}
        </button>
      </form>
    </>
  );
}
