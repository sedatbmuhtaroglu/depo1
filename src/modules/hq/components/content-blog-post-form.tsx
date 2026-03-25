"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { createBlogPostAction, updateBlogPostAction } from "@/modules/hq/actions/content";
import { CmsRichTextEditor } from "@/modules/hq/components/cms-rich-text-editor";
import { ContentPreviewLinkGenerator } from "@/modules/hq/components/content-preview-link-generator";
import { MediaPickerField } from "@/modules/hq/components/media-picker-field";
import { type SeoEditorState, SeoEditorPanel } from "@/modules/hq/components/seo-editor-panel";
import { slugify } from "@/modules/content/shared/slug";

type BlogPostFormInitial = {
  id?: number;
  title?: string | null;
  slug?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  excerpt?: string | null;
  contentHtml?: string | null;
  featuredImageUrl?: string | null;
  authorName?: string | null;
  categoryId?: number | null;
  tags?: string[];
  canonicalUrl?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  focusKeyword?: string | null;
};

type CategoryOption = {
  id: number;
  name: string;
};

type ContentBlogPostFormProps = {
  mode: "create" | "edit";
  baseUrl: string;
  categories: CategoryOption[];
  initial?: BlogPostFormInitial;
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
};

type FormState = {
  ok: boolean;
  message: string;
  id?: number;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function buildSeoState(initial?: BlogPostFormInitial): SeoEditorState {
  return {
    seoTitle: initial?.seoTitle ?? "",
    metaDescription: initial?.metaDescription ?? "",
    canonicalUrl: initial?.canonicalUrl ?? "",
    ogTitle: initial?.ogTitle ?? "",
    ogDescription: initial?.ogDescription ?? "",
    ogImage: initial?.ogImage ?? "",
    robotsIndex: initial?.robotsIndex ?? true,
    robotsFollow: initial?.robotsFollow ?? true,
    focusKeyword: initial?.focusKeyword ?? "",
  };
}

export function ContentBlogPostForm({ mode, baseUrl, categories, initial, mediaAssets }: ContentBlogPostFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initial?.status ?? "DRAFT");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initial?.featuredImageUrl ?? "");
  const [authorName, setAuthorName] = useState(initial?.authorName ?? "");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ? String(initial.categoryId) : "",
  );
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [seo, setSeo] = useState<SeoEditorState>(() => buildSeoState(initial));
  const [createSlugRedirect, setCreateSlugRedirect] = useState(true);

  const resolvedSlug = slugTouched ? slug : slugify(title);

  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result =
        mode === "create" ? await createBlogPostAction(formData) : await updateBlogPostAction(formData);
      return {
        ok: result.success,
        message: result.message,
        id: result.success && "id" in result ? result.id : undefined,
      };
    },
    INITIAL_STATE,
  );

  const postSlug = useMemo(() => resolvedSlug || "yeni-yazi", [resolvedSlug]);
  const previewPath = `/blog/${postSlug}`;
  const previewTokenPath = mode === "edit" && initial?.slug ? `/blog/${initial.slug}` : previewPath;
  const previewLink =
    mode === "edit" && initial?.id
      ? `/hq/content/blog/${initial.id}/preview`
      : previewPath;

  return (
    <form action={action} className="space-y-4">
      {mode === "edit" && initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}

      <section className="grid gap-3 rounded-2xl border border-[var(--ui-border)] p-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Baslik</label>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClasses()}
            required
          />
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Slug</label>
          <input
            name="slug"
            value={resolvedSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            className={fieldClasses()}
            required
          />
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Durum</label>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as "DRAFT" | "PUBLISHED")}
            className={selectClasses()}
          >
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayinda</option>
          </select>
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Ozet</label>
          <textarea
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            className={textareaClasses({ className: "min-h-[92px]" })}
          />
        </div>

        <div className="space-y-1">
          <MediaPickerField
            label="Featured Image URL"
            value={featuredImageUrl}
            onChange={setFeaturedImageUrl}
            assets={mediaAssets}
          />
          <input type="hidden" name="featuredImageUrl" value={featuredImageUrl} readOnly />
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Yazar</label>
          <input
            name="authorName"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            className={fieldClasses()}
            placeholder="Editoryal ekip"
          />
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Kategori</label>
          <select
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={selectClasses()}
          >
            <option value="">Kategori secilmedi</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClasses()}>Etiketler (virgulle)</label>
          <input
            name="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className={fieldClasses()}
            placeholder="qr-menu, siparis, restoran"
          />
        </div>

        <div className="md:col-span-2">
          <CmsRichTextEditor
            label="Icerik"
            value={contentHtml}
            onChange={setContentHtml}
            minHeightClassName="min-h-[320px]"
          />
          <input type="hidden" name="contentHtml" value={contentHtml} readOnly />
        </div>
      </section>

      <input type="hidden" name="seoTitle" value={seo.seoTitle} readOnly />
      <input type="hidden" name="metaDescription" value={seo.metaDescription} readOnly />
      <input type="hidden" name="canonicalUrl" value={seo.canonicalUrl} readOnly />
      <input type="hidden" name="ogTitle" value={seo.ogTitle} readOnly />
      <input type="hidden" name="ogDescription" value={seo.ogDescription} readOnly />
      <input type="hidden" name="ogImage" value={seo.ogImage} readOnly />
      <input type="hidden" name="focusKeyword" value={seo.focusKeyword} readOnly />
      <input type="hidden" name="robotsIndex" value={seo.robotsIndex ? "true" : "false"} readOnly />
      <input type="hidden" name="robotsFollow" value={seo.robotsFollow ? "true" : "false"} readOnly />

      <SeoEditorPanel
        value={seo}
        onChange={setSeo}
        previewPath={previewPath}
        baseUrl={baseUrl}
        fallbackTitle={title || "Yeni Blog Yazisi"}
        fallbackDescription={excerpt || "Blog yazisi aciklamasi"}
        slugPreview={postSlug}
        mediaAssets={mediaAssets}
        featuredImageUrl={featuredImageUrl}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="createSlugRedirect" value={createSlugRedirect ? "true" : "false"} readOnly />
        {mode === "edit" ? (
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)]">
            <input
              type="checkbox"
              checked={createSlugRedirect}
              onChange={(event) => setCreateSlugRedirect(event.target.checked)}
            />
            Slug degisirse otomatik redirect olustur
          </label>
        ) : null}
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending
            ? "Kaydediliyor..."
            : mode === "create"
              ? "Yaziyi Olustur"
              : "Degisiklikleri Kaydet"}
        </button>
        <Link href={previewLink} className={buttonClasses({ variant: "outline" })}>
          Preview
        </Link>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>

      <ContentPreviewLinkGenerator
        targetType="BLOG_POST"
        targetId={initial?.id}
        pathname={previewTokenPath}
      />
    </form>
  );
}
