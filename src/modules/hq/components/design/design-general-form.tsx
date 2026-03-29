"use client";

import { useActionState, useState } from "react";
import { saveLandingDesignGeneralAction } from "@/modules/hq/actions/landing-design";
import type { LandingPublicGeneral } from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";
import { fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { DesignSaveFeedback } from "@/modules/hq/components/design/design-save-feedback";

type Props = {
  initial: LandingPublicGeneral;
};

export function DesignGeneralForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState(saveLandingDesignGeneralAction, undefined);
  const [showTagline, setShowTagline] = useState(initial.showTaglineInHeader);

  return (
    <form action={formAction} className="space-y-5">
      <DesignSaveFeedback state={state} />
      <div className="space-y-1">
        <label className={labelClasses()} htmlFor="brandName">
          Marka adı
        </label>
        <input
          id="brandName"
          name="brandName"
          required
          defaultValue={initial.brandName}
          className={fieldClasses({ className: "w-full max-w-lg" })}
          autoComplete="organization"
        />
        <p className="text-xs text-[var(--ui-text-muted)]">Üst çubukta ve blog JSON-LD’de görünen isim.</p>
      </div>
      <div className="space-y-1">
        <label className={labelClasses()} htmlFor="brandTagline">
          Kısa slogan
        </label>
        <input
          id="brandTagline"
          name="brandTagline"
          defaultValue={initial.brandTagline}
          className={fieldClasses({ className: "w-full max-w-xl" })}
        />
      </div>
      <input type="hidden" name="showTaglineInHeader" value={showTagline ? "true" : "false"} />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ui-text-primary)]">
        <input
          type="checkbox"
          checked={showTagline}
          onChange={(e) => setShowTagline(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--ui-border-strong)]"
        />
        Sloganı masaüstü üst çubukta göster
      </label>
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
