"use client";

import { useMemo } from "react";
import { useActionState } from "react";
import {
  buttonClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { saveMarketingCategoriesAction } from "@/modules/hq/actions/marketing";
import type { MarketingLandingHqData } from "@/modules/marketing/server/landing-content";

type MarketingCategoriesFormProps = {
  site: MarketingLandingHqData;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function MarketingCategoriesForm({ site }: MarketingCategoriesFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveMarketingCategoriesAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  const categoryLines = useMemo(
    () =>
      site.categories
        .map((category) => [category.slug, category.title, category.description ?? "", category.iconName ?? ""].join("|"))
        .join("\n"),
    [site.categories],
  );

  const subcategoryLines = useMemo(
    () =>
      site.categories
        .flatMap((category) =>
          category.subcategories.map((subcategory) =>
            [
              category.slug,
              subcategory.slug,
              subcategory.title,
              subcategory.description ?? "",
              subcategory.ctaLabel ?? "",
              subcategory.ctaHref ?? "",
            ].join("|"),
          ),
        )
        .join("\n"),
    [site.categories],
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <label className={labelClasses()}>Kategori Satirlari</label>
        <textarea
          name="categoryLines"
          defaultValue={categoryLines}
          className={textareaClasses({ className: "min-h-[180px]" })}
        />
        <p className="text-xs text-[var(--ui-text-secondary)]">
          Format: categorySlug|baslik|aciklama|iconName
        </p>
      </div>

      <div className="space-y-1">
        <label className={labelClasses()}>Alt Kategori Satirlari</label>
        <textarea
          name="subcategoryLines"
          defaultValue={subcategoryLines}
          className={textareaClasses({ className: "min-h-[220px]" })}
        />
        <p className="text-xs text-[var(--ui-text-secondary)]">
          Format: categorySlug|subSlug|baslik|aciklama|ctaLabel|ctaHref
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Kategori Icerigini Kaydet"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
