"use client";

import { useActionState, useEffect, useState } from "react";
import { saveLandingDesignColorsAction } from "@/modules/hq/actions/landing-design";
import {
  type LandingPublicColors,
  normalizeHex6,
} from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";
import { fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { DesignSaveFeedback } from "@/modules/hq/components/design/design-save-feedback";

type Props = {
  initial: LandingPublicColors;
};

type ColorKey = keyof LandingPublicColors;

const FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: "primaryBg", label: "Birincil arka plan", hint: "Ana CTA butonları (dolgu)." },
  { key: "primaryFg", label: "Birincil yazı rengi", hint: "Birincil buton üzerindeki metin." },
  { key: "primaryHoverBg", label: "Birincil hover", hint: "Üzerine gelince dolgu." },
  { key: "outlineFg", label: "Çerçeveli buton yazısı", hint: "İkincil (outline) metin." },
  { key: "outlineBorder", label: "Çerçeve rengi", hint: "İkincil buton kenarı." },
  { key: "outlineHoverBg", label: "Çerçeveli hover arka plan", hint: "İkincil hover zemini." },
];

function ColorField({
  k,
  label,
  hint,
  value,
  onChange,
}: {
  k: ColorKey;
  label: string;
  hint: string;
  value: string;
  onChange: (key: ColorKey, v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="space-y-1">
        <label className={labelClasses()} htmlFor={k}>
          {label}
        </label>
        <input
          id={k}
          name={k}
          value={value}
          onChange={(e) => onChange(k, e.target.value)}
          className={fieldClasses({ className: "max-w-xs font-mono text-sm" })}
          placeholder="#c45c3a"
          pattern="^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$"
          required
          autoComplete="off"
        />
        <p className="text-xs text-[var(--ui-text-muted)]">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={normalizeHex6(value) ?? "#c45c3a"}
          onChange={(e) => onChange(k, e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border border-[var(--ui-border)] bg-[var(--ui-surface-bg)]"
        />
      </div>
    </div>
  );
}

export function DesignColorsForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(saveLandingDesignColorsAction, undefined);
  const [values, setValues] = useState<LandingPublicColors>(initial);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  const previewStyle = {
    backgroundColor: values.primaryBg,
    color: values.primaryFg,
  } as const;
  const previewHover = { backgroundColor: values.primaryHoverBg };

  return (
    <div className="space-y-8">
      <DesignSaveFeedback state={state} />
      <form action={formAction} className="space-y-6">
        {FIELDS.map((f) => (
          <ColorField
            key={f.key}
            k={f.key}
            label={f.label}
            hint={f.hint}
            value={values[f.key]}
            onChange={(key, v) => setValues((prev) => ({ ...prev, [key]: v }))}
          />
        ))}
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses({ variant: "primary", className: "rounded-lg px-5" })}
        >
          {pending ? "Kaydediliyor…" : "Renkleri kaydet"}
        </button>
      </form>

      <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-muted)]">
          Önizleme
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            style={previewStyle}
            className="rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, previewHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, previewStyle);
            }}
          >
            Birincil
          </button>
          <button
            type="button"
            style={{
              color: values.outlineFg,
              borderColor: values.outlineBorder,
              backgroundColor: "transparent",
            }}
            className="rounded-lg border-2 px-4 py-2 text-sm font-medium"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = values.outlineHoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Çerçeveli
          </button>
        </div>
      </div>
    </div>
  );
}
