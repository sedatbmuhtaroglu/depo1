"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/actions/admin-login";

export function LoginForm({ initialBannerError }: { initialBannerError?: string | null }) {
  const [state, formAction, isPending] = useActionState(adminLogin, undefined);
  const bannerError = state?.error ?? initialBannerError;

  return (
    <form action={formAction} className="space-y-5">
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

      {bannerError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {bannerError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Giriş yapılıyor..." : "Yönetici girişi"}
      </button>
    </form>
  );
}
