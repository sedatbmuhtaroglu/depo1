"use client";

import { useState } from "react";
import {
  completeInitialStaffPassword,
  completeInitialStaffPasswordWithToken,
} from "@/app/actions/staff-users";

type SetPasswordFormProps = {
  displayName: string;
  redirectTo: string;
  mode: "session" | "token";
  token?: string;
  expiresAt?: string;
};

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function SetPasswordForm({
  displayName,
  redirectTo,
  mode,
  token,
  expiresAt,
}: SetPasswordFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">Personel Girisi</p>
      <h1 className="mt-3 text-2xl font-semibold text-neutral-950">Sifre Belirleme</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Ilk girisinizi tamamlamak icin yeni sifrenizi belirleyin. Hesap: {displayName}
      </p>
      {mode === "token" ? (
        <p className="mt-2 text-xs text-neutral-500">
          Link gecerlilik bitisi: {formatDate(expiresAt)}
        </p>
      ) : null}

      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (isSubmitting) return;
          const form = event.currentTarget;
          const formData = new FormData(form);
          const newPassword = String(formData.get("newPassword") ?? "");
          const confirmPassword = String(formData.get("confirmPassword") ?? "");
          setError("");
          setMessage("");
          setIsSubmitting(true);
          try {
            const result =
              mode === "token"
                ? await completeInitialStaffPasswordWithToken({
                    token: token ?? "",
                    newPassword,
                    confirmPassword,
                  })
                : await completeInitialStaffPassword({ newPassword, confirmPassword });
            if (!result.success) {
              setError(result.message);
              setIsSubmitting(false);
              return;
            }
            setMessage("Sifre kaydedildi. Yonlendiriliyorsunuz...");
            window.setTimeout(() => {
              window.location.replace(redirectTo);
            }, 600);
          } catch {
            setError("Islem sirasinda beklenmeyen bir hata olustu.");
            setIsSubmitting(false);
          }
        }}
      >
        <div>
          <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Yeni Sifre
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-900"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Yeni Sifre (tekrar)
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-neutral-900 outline-none transition focus:border-neutral-900"
          />
        </div>

        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Kaydediliyor..." : "Sifreyi Kaydet ve Devam Et"}
        </button>
      </form>
    </div>
  );
}