"use client";

import { useActionState, useState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  checkboxLabelClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { savePlannedMaintenanceSettingsAction } from "@/modules/hq/actions/content";

type Props = {
  initial: {
    plannedMaintenanceEnabled: boolean;
    plannedMaintenanceStartsAt: Date | null;
    plannedMaintenanceEndsAt: Date | null;
    plannedMaintenanceMessage: string | null;
    plannedMaintenanceAllowedPaths: string | null;
  };
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = { ok: false, message: "" };

const PATH_PRESETS: Array<{ id: string; label: string; paths: string[] }> = [
  {
    id: "default-ops",
    label: "Varsayilan (operasyon)",
    paths: ["/", "/hq", "/glidragiris", "/restaurant", "/waiter", "/kitchen"],
  },
  {
    id: "admin-only",
    label: "Sadece admin",
    paths: ["/", "/hq", "/glidragiris"],
  },
  {
    id: "ops-without-landing",
    label: "Operasyon (landing kapali)",
    paths: ["/hq", "/glidragiris", "/restaurant", "/waiter", "/kitchen"],
  },
];

function toDateTimeLocalValue(value: Date | null): string {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function PlannedMaintenanceForm({ initial }: Props) {
  const initialAllowedPathsValue =
    initial.plannedMaintenanceAllowedPaths ??
    ["/", "/hq", "/glidragiris", "/restaurant", "/waiter", "/kitchen"].join("\n");
  const [allowedPathsValue, setAllowedPathsValue] = useState(initialAllowedPathsValue);
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await savePlannedMaintenanceSettingsAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <label className={checkboxLabelClasses("items-center gap-2 text-sm font-medium")}>
        <input
          type="checkbox"
          name="plannedMaintenanceEnabled"
          defaultChecked={initial.plannedMaintenanceEnabled}
          className={checkboxInputClasses()}
        />
        Planli bakim aktif
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Bakim baslangic</label>
          <input
            type="datetime-local"
            name="plannedMaintenanceStartsAt"
            className={fieldClasses()}
            defaultValue={toDateTimeLocalValue(initial.plannedMaintenanceStartsAt)}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Bakim bitis</label>
          <input
            type="datetime-local"
            name="plannedMaintenanceEndsAt"
            className={fieldClasses()}
            defaultValue={toDateTimeLocalValue(initial.plannedMaintenanceEndsAt)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClasses()}>Bakim aciklama metni</label>
        <textarea
          name="plannedMaintenanceMessage"
          className={textareaClasses({ className: "min-h-[96px]" })}
          maxLength={500}
          defaultValue={initial.plannedMaintenanceMessage ?? ""}
          placeholder="Planli bakim nedeniyle sistem gecici olarak kullanima kapatilacaktir."
        />
      </div>

      <div className="space-y-1">
        <label className={labelClasses()}>Bakimda acik kalacak yol prefixleri</label>
        <div className="flex flex-wrap gap-2">
          {PATH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              onClick={() => setAllowedPathsValue(preset.paths.join("\n"))}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <textarea
          name="plannedMaintenanceAllowedPaths"
          className={textareaClasses({ className: "min-h-[120px] font-mono text-xs" })}
          maxLength={4000}
          value={allowedPathsValue}
          onChange={(event) => setAllowedPathsValue(event.target.value)}
          placeholder="/
/hq
/glidragiris
/restaurant
/waiter
/kitchen"
        />
        <p className="text-xs text-[var(--ui-text-secondary)]">
          Her satira bir prefix girin. Ornek: <code>/hq</code> tum <code>/hq/*</code> yollarini
          acik tutar. Guvenlik icin <code>/hq</code> ve <code>/glidragiris</code> kayitta otomatik
          eklenir.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClasses({ variant: "warning" })} disabled={isPending}>
          {isPending ? "Kaydediliyor..." : "Bakim ayarlarini kaydet"}
        </button>
        <p className="text-xs text-[var(--ui-text-secondary)]">
          Not: Bu listedeki yollar acik kalir, diger tum yollar bakim ekranini gorur.
        </p>
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
