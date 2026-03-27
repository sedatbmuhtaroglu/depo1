"use client";

import React, { useState, useTransition } from "react";
import { Headphones } from "lucide-react";
import { startSupportImpersonationAction } from "@/modules/hq/actions/support-impersonation";
import { buttonClasses } from "@/lib/ui/button-variants";

const REASONS = [
  { value: "setup", label: "Kurulum / onboarding desteği" },
  { value: "bug", label: "Hata / teknik inceleme" },
  { value: "billing", label: "Fatura / plan sorusu" },
  { value: "training", label: "Eğitim / kullanım" },
  { value: "other", label: "Diğer (not zorunlu)" },
] as const;

const DURATIONS = [
  { value: 15, label: "15 dakika" },
  { value: 30, label: "30 dakika" },
  { value: 60, label: "60 dakika" },
] as const;

type Props = {
  tenantId: number;
};

export function HqSupportEntryDialog({ tenantId }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({
          variant: "outline",
          size: "md",
          className: "inline-flex items-center gap-2",
        })}
      >
        <Headphones className="h-4 w-4" aria-hidden />
        Destek olarak giriş yap
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-entry-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-5 shadow-xl">
            <h2
              id="support-entry-title"
              className="text-lg font-semibold text-[var(--ui-text-primary)]"
            >
              Destek oturumu
            </h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Bu işletmenin restoran paneline müşteri şifresi olmadan sınırlı süreyle erişirsiniz. İşlem kayıt altına
              alınır.
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  setError(null);
                  try {
                    const result = await startSupportImpersonationAction(formData);
                    if (!result.success) {
                      setError(result.message);
                    }
                  } catch (e) {
                    const digest =
                      typeof e === "object" && e !== null && "digest" in e
                        ? String((e as { digest?: unknown }).digest)
                        : "";
                    if (digest.startsWith("NEXT_REDIRECT")) {
                      return;
                    }
                    const msg = e instanceof Error ? e.message : "İşlem başarısız.";
                    setError(msg);
                  }
                });
              }}
            >
              <input type="hidden" name="tenantId" value={tenantId} />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  Destek nedeni
                </label>
                <select
                  name="reasonPreset"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-canvas)] px-3 py-2 text-sm"
                  defaultValue="setup"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  Not (isteğe bağlı; &quot;Diğer&quot; için zorunlu)
                </label>
                <textarea
                  name="note"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg-canvas)] px-3 py-2 text-sm"
                  placeholder="Kısa bağlam (ör. hangi ekran, hangi sorun)"
                />
              </div>

              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  Süre
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <label
                      key={d.value}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm has-[:checked]:border-[var(--ui-accent)] has-[:checked]:bg-[var(--ui-accent-soft)]"
                    >
                      <input type="radio" name="durationMinutes" value={d.value} defaultChecked={d.value === 30} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>

              {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  className={buttonClasses({ variant: "ghost", size: "md" })}
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className={buttonClasses({ variant: "primary", size: "md" })}
                  disabled={pending}
                >
                  {pending ? "Başlatılıyor…" : "Panele git"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
