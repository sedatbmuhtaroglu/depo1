"use client";

import { useActionState } from "react";
import { buttonClasses, fieldClasses, labelClasses, selectClasses } from "@/lib/ui/button-variants";
import { createPackageAction } from "@/modules/hq/actions/packages";

type HqPackageCreateFormProps = {
  availableCodes: string[];
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function HqPackageCreateForm({ availableCodes }: HqPackageCreateFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await createPackageAction(formData);
      return {
        ok: result.success,
        message: result.message,
      };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Gorunen Paket Adi</label>
          <input
            name="displayName"
            className={fieldClasses()}
            placeholder="Ornek: Pro Plus"
            required
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Teknik Kod (stabil)</label>
          <select
            name="code"
            className={selectClasses()}
            defaultValue={availableCodes[0] ?? ""}
            disabled={availableCodes.length === 0}
            required
          >
            {availableCodes.length === 0 ? (
              <option value="">Tum teknik kodlar kullaniliyor</option>
            ) : (
              availableCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-[var(--ui-text-primary)]">
        <input type="checkbox" name="isActive" value="1" defaultChecked />
        Paket aktif olsun
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={buttonClasses({ variant: "primary" })}
          disabled={isPending || availableCodes.length === 0}
        >
          {isPending ? "Olusturuluyor..." : "Paket Olustur"}
        </button>
        <p className="text-xs text-[var(--ui-text-secondary)]">
          Teknik kod sadece kontrollu secilir; sonradan degistirilmez.
        </p>
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
