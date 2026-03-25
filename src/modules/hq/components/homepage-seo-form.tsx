"use client";

import { useActionState, useState } from "react";
import { buttonClasses } from "@/lib/ui/button-variants";
import { saveHomepageSeoSettingsAction } from "@/modules/hq/actions/content";
import { type SeoEditorState, SeoEditorPanel } from "@/modules/hq/components/seo-editor-panel";

type HomepageSeoFormProps = {
  baseUrl: string;
  mediaAssets: Array<{
    id: number;
    storagePath: string;
    title: string | null;
    altText: string | null;
    caption: string | null;
    mimeType: string;
    width: number | null;
    height: number | null;
    byteSize: number;
    createdAt: Date | string;
    fileName: string;
  }>;
  initial: {
    brandName: string;
    brandTagline: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoCanonicalUrl: string | null;
    seoOgTitle: string | null;
    seoOgDescription: string | null;
    seoOgImageUrl: string | null;
    seoRobotsIndex: boolean;
    seoRobotsFollow: boolean;
  };
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function buildInitialSeoState(initial: HomepageSeoFormProps["initial"]): SeoEditorState {
  return {
    seoTitle: initial.seoTitle ?? "",
    metaDescription: initial.seoDescription ?? "",
    canonicalUrl: initial.seoCanonicalUrl ?? "",
    ogTitle: initial.seoOgTitle ?? "",
    ogDescription: initial.seoOgDescription ?? "",
    ogImage: initial.seoOgImageUrl ?? "",
    robotsIndex: initial.seoRobotsIndex ?? true,
    robotsFollow: initial.seoRobotsFollow ?? true,
    focusKeyword: "",
  };
}

export function HomepageSeoForm({ baseUrl, initial, mediaAssets }: HomepageSeoFormProps) {
  const [seo, setSeo] = useState<SeoEditorState>(() => buildInitialSeoState(initial));

  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveHomepageSeoSettingsAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="seoTitle" value={seo.seoTitle} readOnly />
      <input type="hidden" name="metaDescription" value={seo.metaDescription} readOnly />
      <input type="hidden" name="canonicalUrl" value={seo.canonicalUrl} readOnly />
      <input type="hidden" name="ogTitle" value={seo.ogTitle} readOnly />
      <input type="hidden" name="ogDescription" value={seo.ogDescription} readOnly />
      <input type="hidden" name="ogImage" value={seo.ogImage} readOnly />
      <input type="hidden" name="robotsIndex" value={seo.robotsIndex ? "true" : "false"} readOnly />
      <input type="hidden" name="robotsFollow" value={seo.robotsFollow ? "true" : "false"} readOnly />

      <SeoEditorPanel
        value={seo}
        onChange={setSeo}
        previewPath="/"
        baseUrl={baseUrl}
        fallbackTitle={initial.brandName}
        fallbackDescription={initial.brandTagline ?? "Ana sayfa aciklamasi"}
        slugPreview=""
        mediaAssets={mediaAssets}
      />

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Ana Sayfa SEO Kaydet"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
