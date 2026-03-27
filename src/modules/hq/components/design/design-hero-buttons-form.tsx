"use client";

import { useActionState, useState } from "react";
import { saveLandingDesignButtonsAction } from "@/modules/hq/actions/landing-design";
import type { LandingPublicCta } from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";
import { fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { DesignSaveFeedback } from "@/modules/hq/components/design/design-save-feedback";

type Props = {
  primary: LandingPublicCta;
  secondary: LandingPublicCta;
};

function CtaPair({
  title,
  p,
  onChange,
  prefix,
}: {
  title: string;
  p: LandingPublicCta;
  onChange: (next: LandingPublicCta) => void;
  prefix: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-4">
      <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">{title}</h3>
      <input type="hidden" name={`${prefix}Enabled`} value={p.enabled ? "true" : "false"} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={p.enabled}
          onChange={(e) => onChange({ ...p, enabled: e.target.checked })}
          className="h-4 w-4 rounded"
        />
        Hero bölümünde göster
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()} htmlFor={`${prefix}Label`}>
            Metin
          </label>
          <input
            id={`${prefix}Label`}
            name={`${prefix}Label`}
            value={p.label}
            onChange={(e) => onChange({ ...p, label: e.target.value })}
            className={fieldClasses({ className: "w-full" })}
            required
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()} htmlFor={`${prefix}Href`}>
            Bağlantı
          </label>
          <input
            id={`${prefix}Href`}
            name={`${prefix}Href`}
            value={p.href}
            onChange={(e) => onChange({ ...p, href: e.target.value })}
            className={fieldClasses({ className: "w-full font-mono text-sm" })}
            required
          />
        </div>
      </div>
    </div>
  );
}

export function DesignHeroButtonsForm({ primary, secondary }: Props) {
  const [state, formAction, pending] = useActionState(saveLandingDesignButtonsAction, undefined);
  const [pri, setPri] = useState(primary);
  const [sec, setSec] = useState(secondary);

  return (
    <form action={formAction} className="space-y-6">
      <DesignSaveFeedback state={state} />
      <CtaPair title="Birincil CTA" p={pri} onChange={setPri} prefix="heroPrimary" />
      <CtaPair title="İkincil CTA (çerçeveli)" p={sec} onChange={setSec} prefix="heroSecondary" />
      <p className="text-xs text-[var(--ui-text-muted)]">
        Üst çubuktaki CTA, &quot;Üst menü ve CTA&quot; sayfasından yönetilir.
      </p>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses({ variant: "primary", className: "rounded-lg px-5" })}
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
