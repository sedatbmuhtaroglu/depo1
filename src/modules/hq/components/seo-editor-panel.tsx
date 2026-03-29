"use client";

import { checkboxInputClasses, fieldClasses, labelClasses, textareaClasses } from "@/lib/ui/button-variants";
import { evaluateSeoCompleteness } from "@/modules/content/shared/seo-score";
import { MediaPickerField, type MediaAssetOption } from "@/modules/hq/components/media-picker-field";

export type SeoEditorState = {
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  focusKeyword: string;
};

type SeoEditorPanelProps = {
  value: SeoEditorState;
  onChange: (next: SeoEditorState) => void;
  previewPath: string;
  baseUrl: string;
  fallbackTitle: string;
  fallbackDescription: string;
  slugPreview: string;
  mediaAssets?: MediaAssetOption[];
  featuredImageUrl?: string | null;
};

function getLengthClass(length: number, min: number, max: number): string {
  if (length === 0) return "text-amber-700";
  if (length < min || length > max) return "text-amber-700";
  return "text-emerald-700";
}

function getScoreTone(status: "strong" | "medium" | "weak") {
  if (status === "strong") return "bg-emerald-500";
  if (status === "medium") return "bg-amber-500";
  return "bg-rose-500";
}

function getScoreLabel(status: "strong" | "medium" | "weak") {
  if (status === "strong") return "SEO iyi";
  if (status === "medium") return "SEO orta";
  return "SEO zayif";
}

export function SeoEditorPanel({
  value,
  onChange,
  previewPath,
  baseUrl,
  fallbackTitle,
  fallbackDescription,
  slugPreview,
  mediaAssets = [],
  featuredImageUrl,
}: SeoEditorPanelProps) {
  const displayTitle = value.seoTitle.trim() || fallbackTitle;
  const displayDescription = value.metaDescription.trim() || fallbackDescription;
  const displayUrl = `${baseUrl.replace(/\/$/, "")}${previewPath}`;

  const titleLength = value.seoTitle.trim().length;
  const descriptionLength = value.metaDescription.trim().length;

  const seoReport = evaluateSeoCompleteness({
    seoTitle: value.seoTitle,
    metaDescription: value.metaDescription,
    canonicalUrl: value.canonicalUrl,
    ogTitle: value.ogTitle,
    ogDescription: value.ogDescription,
    ogImage: value.ogImage,
    slug: slugPreview,
    robotsIndex: value.robotsIndex,
    robotsFollow: value.robotsFollow,
    featuredImageUrl,
  });

  const setField = <K extends keyof SeoEditorState>(key: K, fieldValue: SeoEditorState[K]) => {
    onChange({
      ...value,
      [key]: fieldValue,
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--ui-border)] p-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">SEO</h3>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Arama motoru metadatasini duzenleyin ve Google onizlemesini canli takip edin.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">SEO Completeness</p>
          <span className="rounded-full border border-[var(--ui-border)] px-2 py-0.5 text-xs font-semibold text-[var(--ui-text-primary)]">
            {getScoreLabel(seoReport.status)} - %{seoReport.score}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--ui-border-subtle)]">
          <div className={`h-full ${getScoreTone(seoReport.status)}`} style={{ width: `${seoReport.score}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">Google Sonuc Onizleme</p>
        <p className="mt-2 text-[22px] leading-7 text-[#1a0dab]">{displayTitle}</p>
        <p className="mt-1 text-sm text-[#188038]">{displayUrl}</p>
        <p className="mt-1 text-sm text-[#3c4043]">{displayDescription}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>SEO Title</label>
          <input value={value.seoTitle} onChange={(event) => setField("seoTitle", event.target.value)} className={fieldClasses()} />
          <p className={`text-xs ${getLengthClass(titleLength, 30, 60)}`}>{titleLength}/60 (onerilen: 30-60)</p>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Meta Description</label>
          <textarea
            value={value.metaDescription}
            onChange={(event) => setField("metaDescription", event.target.value)}
            className={textareaClasses({ className: "min-h-[94px]" })}
          />
          <p className={`text-xs ${getLengthClass(descriptionLength, 70, 160)}`}>
            {descriptionLength}/160 (onerilen: 70-160)
          </p>
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Canonical URL</label>
          <input
            value={value.canonicalUrl}
            onChange={(event) => setField("canonicalUrl", event.target.value)}
            className={fieldClasses()}
            placeholder="https://www.ornek.com/blog/yazi"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>OG Title</label>
          <input value={value.ogTitle} onChange={(event) => setField("ogTitle", event.target.value)} className={fieldClasses()} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>OG Description</label>
          <input
            value={value.ogDescription}
            onChange={(event) => setField("ogDescription", event.target.value)}
            className={fieldClasses()}
          />
        </div>

        <div className="md:col-span-2">
          <MediaPickerField
            label="OG Image URL"
            value={value.ogImage}
            onChange={(next) => setField("ogImage", next)}
            assets={mediaAssets}
            helperText="OpenGraph paylasim karti icin gorsel secin."
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Focus Keyword</label>
          <input
            value={value.focusKeyword}
            onChange={(event) => setField("focusKeyword", event.target.value)}
            className={fieldClasses()}
            placeholder="qr menu siparis sistemi"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)]">
          <input
            type="checkbox"
            checked={value.robotsIndex}
            onChange={(event) => setField("robotsIndex", event.target.checked)}
            className={checkboxInputClasses()}
          />
          robots index
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)]">
          <input
            type="checkbox"
            checked={value.robotsFollow}
            onChange={(event) => setField("robotsFollow", event.target.checked)}
            className={checkboxInputClasses()}
          />
          robots follow
        </label>
      </div>

      <div className="rounded-xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/60 p-3 text-xs">
        <p className="font-semibold text-[var(--ui-text-primary)]">Slug Onizleme</p>
        <p className="mt-1 text-[var(--ui-text-secondary)]">{displayUrl}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="font-semibold">Eksikler ({seoReport.missing.length})</p>
          <ul className="mt-1 space-y-1">
            {seoReport.missing.length > 0 ? seoReport.missing.map((item) => <li key={item}>- {item}</li>) : <li>- Yok</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">Uyarilar ({seoReport.warnings.length})</p>
          <ul className="mt-1 space-y-1">
            {seoReport.warnings.length > 0 ? seoReport.warnings.map((item) => <li key={item}>- {item}</li>) : <li>- Yok</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <p className="font-semibold">Basarili ({seoReport.successes.length})</p>
          <ul className="mt-1 space-y-1">
            {seoReport.successes.length > 0 ? seoReport.successes.map((item) => <li key={item}>- {item}</li>) : <li>- Henuz yok</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
