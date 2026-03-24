"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
} from "@/lib/ui/button-variants";
import { deleteTenantPermanentlyAction } from "@/modules/hq/actions/tenant-delete";

type TenantPermanentDeleteFormProps = {
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
};

type FormState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function TenantPermanentDeleteForm({
  tenantId,
  tenantName,
  tenantSlug,
}: TenantPermanentDeleteFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await deleteTenantPermanentlyAction(formData);
      if (!result.success) {
        return { ok: false, message: result.message } satisfies FormState;
      }
      return {
        ok: true,
        message: result.message,
        redirectTo: result.redirectTo,
      } satisfies FormState;
    },
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.replace(state.redirectTo);
    }
  }, [router, state.ok, state.redirectTo]);

  return (
    <>
      <button
        type="button"
        className={buttonClasses({ variant: "danger" })}
        onClick={() => setIsOpen(true)}
      >
        Tenanti Kalici Sil
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-[var(--ui-danger-border)] bg-[var(--ui-surface)] p-4 shadow-xl">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--ui-text-primary)]">
                Tenanti Kalici Sil
              </p>
              <p className="text-sm text-[var(--ui-text-secondary)]">
                Bu islem geri alinamaz. Tenantin operasyon verileri kalici olarak silinecektir.
              </p>
              <p className="text-xs text-[var(--ui-text-secondary)]">
                Onay icin tenant slug veya adini aynen girin: <span className="font-medium">{tenantSlug}</span> veya{" "}
                <span className="font-medium">{tenantName}</span>
              </p>
            </div>

            <form action={action} className="mt-4 space-y-3">
              <input type="hidden" name="tenantId" value={tenantId} />

              <div className="space-y-1">
                <label className={labelClasses()}>Tenant slug veya ad</label>
                <input
                  name="confirmIdentity"
                  required
                  className={fieldClasses()}
                  placeholder={tenantSlug}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1">
                <label className={labelClasses()}>Onay ifadesi</label>
                <input
                  name="confirmPhrase"
                  required
                  className={fieldClasses()}
                  placeholder="KALICI SIL"
                  autoComplete="off"
                />
              </div>

              <label className="flex items-start gap-2 text-sm text-[var(--ui-text-secondary)]">
                <input name="irreversibleAck" type="checkbox" className={checkboxInputClasses()} required />
                <span>Bu islemin geri alinamaz oldugunu anladim.</span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={buttonClasses({ variant: "outline" })}
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                >
                  Vazgec
                </button>
                <button
                  type="submit"
                  className={buttonClasses({ variant: "danger" })}
                  disabled={isPending}
                >
                  {isPending ? "Siliniyor..." : "Kalici Silmeyi Onayla"}
                </button>
              </div>

              {state.message ? (
                <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
                  {state.message}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
