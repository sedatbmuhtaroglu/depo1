"use server";

import { Prisma, type ContentPreviewTargetType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { prisma } from "@/lib/prisma";
import {
  hasRedirectChainRisk,
  normalizeRedirectFromPath,
  normalizeRedirectToPath,
  parseRedirectStatusCode,
} from "@/modules/content/server/redirect-rules";
import {
  normalizeOptionalMediaText,
  parseOptionalPositiveInteger,
  removeMediaFile,
  saveMediaFile,
} from "@/modules/content/server/media-assets";
import {
  appendPreviewTokenToPath,
  createPreviewToken,
} from "@/modules/content/server/preview-token";
import { normalizeMaintenanceAllowedPathPrefixes } from "@/modules/content/server/content-queries";
import {
  computeReadingTimeMinutes,
  normalizeOptionalBoolean,
  normalizeOptionalText,
  normalizeRichHtmlInput,
  normalizeSlugValue,
  normalizeText,
  parseContentStatus,
  parseTagsInput,
} from "@/modules/content/server/content-utils";
import { embedBlocksToPrismaJson, normalizeEmbedBlocksInput } from "@/modules/content/server/embed-blocks-parse";
import { assertHqMutationGuard } from "@/modules/hq/actions/_shared";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";

type ActionResult = { success: true; message: string } | { success: false; message: string };
type ActionResultWithId =
  | { success: true; message: string; id: number }
  | { success: false; message: string };

type PreviewLinkActionResult =
  | { success: true; message: string; url: string; expiresAt: string }
  | { success: false; message: string };

function parseId(value: FormDataEntryValue | null): number | null {
  const parsed = Number.parseInt((value?.toString() ?? "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseSortOrder(value: FormDataEntryValue | null): number {
  const parsed = Number.parseInt((value?.toString() ?? "").trim(), 10);
  if (!Number.isInteger(parsed)) return 0;
  return Math.max(0, Math.min(parsed, 9_999));
}

function normalizeOptionalAbsoluteUrl(value: FormDataEntryValue | null, maxLength = 320): string | null {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeOptionalImageUrl(value: FormDataEntryValue | null, maxLength = 320): string | null {
  const normalized = normalizeOptionalText(value, maxLength);
  if (!normalized) return null;

  if (normalized.startsWith("/")) return normalized;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function parseOptionalDateTimeInput(value: FormDataEntryValue | null): Date | null {
  const normalized = normalizeOptionalText(value, 64);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseSeoInput(formData: FormData) {
  return {
    seoTitle: normalizeOptionalText(formData.get("seoTitle"), 160),
    metaDescription: normalizeOptionalText(formData.get("metaDescription"), 320),
    canonicalUrl: normalizeOptionalAbsoluteUrl(formData.get("canonicalUrl"), 320),
    ogTitle: normalizeOptionalText(formData.get("ogTitle"), 160),
    ogDescription: normalizeOptionalText(formData.get("ogDescription"), 320),
    ogImage: normalizeOptionalImageUrl(formData.get("ogImage"), 320),
    robotsIndex: normalizeOptionalBoolean(formData.get("robotsIndex")),
    robotsFollow: normalizeOptionalBoolean(formData.get("robotsFollow")),
    focusKeyword: normalizeOptionalText(formData.get("focusKeyword"), 120),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateContentPaths(slug?: string | null) {
  revalidatePath("/hq/content/pages");
  revalidatePath("/hq/content/blog");
  revalidatePath("/hq/content/blog/categories");
  revalidatePath("/hq/content/redirects");
  revalidatePath("/hq/media");
  revalidatePath("/hq/settings/seo");
  revalidatePath("/blog");
  revalidatePath("/pages");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (slug) {
    revalidatePath(`/pages/${slug}`);
    revalidatePath(`/blog/${slug}`);
  }
}

async function ensureSlugRedirect(params: {
  fromPath: string;
  toPath: string;
  createdBy: string;
  note: string;
}) {
  if (params.fromPath === params.toPath) return;

  const existing = await prisma.redirectRule.findUnique({
    where: { fromPath: params.fromPath },
    select: { id: true, toPath: true, isActive: true, note: true },
  });

  if (!existing) {
    await prisma.redirectRule.create({
      data: {
        fromPath: params.fromPath,
        toPath: params.toPath,
        statusCode: 301,
        isActive: true,
        note: params.note,
        createdBy: params.createdBy,
      },
    });
    return;
  }

  if (existing.toPath === params.toPath && existing.isActive) {
    return;
  }

  if (existing.toPath === params.toPath && !existing.isActive) {
    await prisma.redirectRule.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        statusCode: 301,
      },
    });
  }
}

export async function createPageAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const title = normalizeText(formData.get("title"), 180);
    const slug = normalizeSlugValue(formData.get("slug"), title, "page");
    const status = parseContentStatus(formData.get("status")?.toString());
    const excerpt = normalizeOptionalText(formData.get("excerpt"), 420);
    const coverImageUrl = normalizeOptionalImageUrl(formData.get("coverImageUrl"), 320);
    const contentHtml = normalizeRichHtmlInput(formData.get("contentHtml"), 80_000);
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const seo = parseSeoInput(formData);
    const embedBlocksResult = normalizeEmbedBlocksInput(formData.get("embedBlocksJson"));

    if (!title) return { success: false, message: "Baslik zorunludur." };
    if (!contentHtml) return { success: false, message: "Icerik zorunludur." };
    if (!embedBlocksResult.ok) return { success: false, message: embedBlocksResult.message };

    const now = new Date();
    const created = await prisma.page.create({
      data: {
        title,
        slug,
        status,
        excerpt,
        coverImageUrl,
        contentHtml,
        embedBlocks: embedBlocksToPrismaJson(embedBlocksResult.blocks),
        publishedAt: status === "PUBLISHED" ? now : null,
        authorName: hq.username,
        sortOrder,
        isHomepageSelectable: false,
        seoTitle: seo.seoTitle,
        metaDescription: seo.metaDescription,
        canonicalUrl: seo.canonicalUrl,
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        robotsIndex: seo.robotsIndex,
        robotsFollow: seo.robotsFollow,
        focusKeyword: seo.focusKeyword,
      },
      select: { id: true, slug: true },
    });

    revalidateContentPaths(created.slug);
    return { success: true, message: "Sayfa olusturuldu.", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu slug zaten kullaniliyor." };
    }
    return { success: false, message: "Sayfa olusturulamadi." };
  }
}

export async function updatePageAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz sayfa." };

    const existing = await prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true },
    });
    if (!existing) return { success: false, message: "Sayfa bulunamadi." };

    const title = normalizeText(formData.get("title"), 180);
    const slug = normalizeSlugValue(formData.get("slug"), title, "page");
    const status = parseContentStatus(formData.get("status")?.toString());
    const excerpt = normalizeOptionalText(formData.get("excerpt"), 420);
    const coverImageUrl = normalizeOptionalImageUrl(formData.get("coverImageUrl"), 320);
    const contentHtml = normalizeRichHtmlInput(formData.get("contentHtml"), 80_000);
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const createSlugRedirect = normalizeOptionalBoolean(formData.get("createSlugRedirect"));
    const seo = parseSeoInput(formData);
    const embedBlocksResult = normalizeEmbedBlocksInput(formData.get("embedBlocksJson"));

    if (!title) return { success: false, message: "Baslik zorunludur." };
    if (!contentHtml) return { success: false, message: "Icerik zorunludur." };
    if (!embedBlocksResult.ok) return { success: false, message: embedBlocksResult.message };

    const now = new Date();
    const nextPublishedAt = status === "PUBLISHED" ? (existing.publishedAt ?? now) : null;

    const updated = await prisma.page.update({
      where: { id: existing.id },
      data: {
        title,
        slug,
        status,
        excerpt,
        coverImageUrl,
        contentHtml,
        embedBlocks: embedBlocksToPrismaJson(embedBlocksResult.blocks),
        publishedAt: nextPublishedAt,
        sortOrder,
        isHomepageSelectable: false,
        seoTitle: seo.seoTitle,
        metaDescription: seo.metaDescription,
        canonicalUrl: seo.canonicalUrl,
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        robotsIndex: seo.robotsIndex,
        robotsFollow: seo.robotsFollow,
        focusKeyword: seo.focusKeyword,
      },
      select: { id: true, slug: true },
    });

    if (existing.slug !== updated.slug && createSlugRedirect) {
      await ensureSlugRedirect({
        fromPath: `/pages/${existing.slug}`,
        toPath: `/pages/${updated.slug}`,
        createdBy: hq.username,
        note: "Auto: page slug degisimi",
      });
    }

    revalidateContentPaths(existing.slug);
    revalidateContentPaths(updated.slug);
    return { success: true, message: "Sayfa guncellendi.", id: updated.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu slug zaten kullaniliyor." };
    }
    return { success: false, message: "Sayfa guncellenemedi." };
  }
}

export async function deletePageAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz sayfa." };

    const row = await prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!row) return { success: false, message: "Sayfa bulunamadi." };

    await prisma.page.delete({ where: { id: row.id } });
    revalidateContentPaths(row.slug);
    return { success: true, message: "Sayfa silindi." };
  } catch {
    return { success: false, message: "Sayfa silinemedi." };
  }
}

export async function createBlogPostAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const title = normalizeText(formData.get("title"), 180);
    const slug = normalizeSlugValue(formData.get("slug"), title, "blog");
    const status = parseContentStatus(formData.get("status")?.toString());
    const excerpt = normalizeOptionalText(formData.get("excerpt"), 420);
    const contentHtml = normalizeRichHtmlInput(formData.get("contentHtml"), 120_000);
    const featuredImageUrl = normalizeOptionalImageUrl(formData.get("featuredImageUrl"), 320);
    const categoryId = parseId(formData.get("categoryId"));
    const tags = parseTagsInput(formData.get("tags"));
    const authorName = normalizeOptionalText(formData.get("authorName"), 120) ?? hq.username;
    const seo = parseSeoInput(formData);
    const embedBlocksResult = normalizeEmbedBlocksInput(formData.get("embedBlocksJson"));

    if (!title) return { success: false, message: "Baslik zorunludur." };
    if (!contentHtml) return { success: false, message: "Icerik zorunludur." };
    if (!embedBlocksResult.ok) return { success: false, message: embedBlocksResult.message };

    const now = new Date();
    const created = await prisma.blogPost.create({
      data: {
        title,
        slug,
        status,
        excerpt,
        contentHtml,
        embedBlocks: embedBlocksToPrismaJson(embedBlocksResult.blocks),
        featuredImageUrl,
        publishedAt: status === "PUBLISHED" ? now : null,
        authorName,
        categoryId,
        tags,
        readingTimeMinutes: computeReadingTimeMinutes(contentHtml),
        canonicalUrl: seo.canonicalUrl,
        seoTitle: seo.seoTitle,
        metaDescription: seo.metaDescription,
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        robotsIndex: seo.robotsIndex,
        robotsFollow: seo.robotsFollow,
        focusKeyword: seo.focusKeyword,
      },
      select: { id: true, slug: true },
    });

    revalidateContentPaths(created.slug);
    return { success: true, message: "Blog yazisi olusturuldu.", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu slug zaten kullaniliyor." };
    }
    return { success: false, message: "Blog yazisi olusturulamadi." };
  }
}

export async function updateBlogPostAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz blog yazisi." };

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true },
    });
    if (!existing) return { success: false, message: "Blog yazisi bulunamadi." };

    const title = normalizeText(formData.get("title"), 180);
    const slug = normalizeSlugValue(formData.get("slug"), title, "blog");
    const status = parseContentStatus(formData.get("status")?.toString());
    const excerpt = normalizeOptionalText(formData.get("excerpt"), 420);
    const contentHtml = normalizeRichHtmlInput(formData.get("contentHtml"), 120_000);
    const featuredImageUrl = normalizeOptionalImageUrl(formData.get("featuredImageUrl"), 320);
    const categoryId = parseId(formData.get("categoryId"));
    const tags = parseTagsInput(formData.get("tags"));
    const authorName = normalizeOptionalText(formData.get("authorName"), 120);
    const createSlugRedirect = normalizeOptionalBoolean(formData.get("createSlugRedirect"));
    const seo = parseSeoInput(formData);
    const embedBlocksResult = normalizeEmbedBlocksInput(formData.get("embedBlocksJson"));

    if (!title) return { success: false, message: "Baslik zorunludur." };
    if (!contentHtml) return { success: false, message: "Icerik zorunludur." };
    if (!embedBlocksResult.ok) return { success: false, message: embedBlocksResult.message };

    const now = new Date();
    const nextPublishedAt = status === "PUBLISHED" ? (existing.publishedAt ?? now) : null;

    const updated = await prisma.blogPost.update({
      where: { id: existing.id },
      data: {
        title,
        slug,
        status,
        excerpt,
        contentHtml,
        embedBlocks: embedBlocksToPrismaJson(embedBlocksResult.blocks),
        featuredImageUrl,
        publishedAt: nextPublishedAt,
        authorName,
        categoryId,
        tags,
        readingTimeMinutes: computeReadingTimeMinutes(contentHtml),
        canonicalUrl: seo.canonicalUrl,
        seoTitle: seo.seoTitle,
        metaDescription: seo.metaDescription,
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        robotsIndex: seo.robotsIndex,
        robotsFollow: seo.robotsFollow,
        focusKeyword: seo.focusKeyword,
      },
      select: { id: true, slug: true },
    });

    if (existing.slug !== updated.slug && createSlugRedirect) {
      await ensureSlugRedirect({
        fromPath: `/blog/${existing.slug}`,
        toPath: `/blog/${updated.slug}`,
        createdBy: hq.username,
        note: "Auto: blog slug degisimi",
      });
    }

    revalidateContentPaths(existing.slug);
    revalidateContentPaths(updated.slug);
    return { success: true, message: "Blog yazisi guncellendi.", id: updated.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu slug zaten kullaniliyor." };
    }
    return { success: false, message: "Blog yazisi guncellenemedi." };
  }
}

export async function deleteBlogPostAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz blog yazisi." };

    const row = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!row) return { success: false, message: "Blog yazisi bulunamadi." };

    await prisma.blogPost.delete({ where: { id: row.id } });
    revalidateContentPaths(row.slug);
    return { success: true, message: "Blog yazisi silindi." };
  } catch {
    return { success: false, message: "Blog yazisi silinemedi." };
  }
}

export async function createBlogCategoryAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const name = normalizeText(formData.get("name"), 120);
    const slug = normalizeSlugValue(formData.get("slug"), name, "kategori");
    const description = normalizeOptionalText(formData.get("description"), 320);
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = normalizeOptionalBoolean(formData.get("isActive"));

    if (!name) return { success: false, message: "Kategori adi zorunludur." };

    const created = await prisma.blogCategory.create({
      data: {
        name,
        slug,
        description,
        sortOrder,
        isActive,
      },
      select: { id: true },
    });

    revalidateContentPaths();
    return { success: true, message: "Kategori olusturuldu.", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu kategori slug'i zaten kullaniliyor." };
    }
    return { success: false, message: "Kategori olusturulamadi." };
  }
}

export async function updateBlogCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz kategori." };

    const name = normalizeText(formData.get("name"), 120);
    const slug = normalizeSlugValue(formData.get("slug"), name, "kategori");
    const description = normalizeOptionalText(formData.get("description"), 320);
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const isActive = normalizeOptionalBoolean(formData.get("isActive"));

    if (!name) return { success: false, message: "Kategori adi zorunludur." };

    await prisma.blogCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        sortOrder,
        isActive,
      },
    });

    revalidateContentPaths();
    return { success: true, message: "Kategori guncellendi." };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu kategori slug'i zaten kullaniliyor." };
    }
    return { success: false, message: "Kategori guncellenemedi." };
  }
}

export async function deleteBlogCategoryAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz kategori." };

    await prisma.blogCategory.delete({ where: { id } });
    revalidateContentPaths();
    return { success: true, message: "Kategori silindi." };
  } catch {
    return { success: false, message: "Kategori silinemedi. Kategoriye bagli yazi olabilir." };
  }
}

export async function createRedirectRuleAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const fromPath = normalizeRedirectFromPath(formData.get("fromPath")?.toString());
    const toPath = normalizeRedirectToPath(formData.get("toPath")?.toString());
    const statusCode = parseRedirectStatusCode(formData.get("statusCode")?.toString());
    const isActive = normalizeOptionalBoolean(formData.get("isActive"));
    const note = normalizeOptionalText(formData.get("note"), 280);

    if (!fromPath) return { success: false, message: "Gecerli bir from path girin." };
    if (!toPath) return { success: false, message: "Gecerli bir to path girin." };
    if (fromPath === toPath) return { success: false, message: "Ayni path'e yonlendirme yapilamaz." };

    const hasChainRisk = await hasRedirectChainRisk(fromPath, toPath);
    if (hasChainRisk) {
      return { success: false, message: "Redirect chain/loop riski tespit edildi." };
    }

    const created = await prisma.redirectRule.create({
      data: {
        fromPath,
        toPath,
        statusCode,
        isActive,
        note,
        createdBy: hq.username,
      },
      select: { id: true },
    });

    revalidateContentPaths();
    return { success: true, message: "Redirect kurali olusturuldu.", id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu from path zaten kullanimda." };
    }
    return { success: false, message: "Redirect kurali olusturulamadi." };
  }
}

export async function updateRedirectRuleAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz redirect kaydi." };

    const fromPath = normalizeRedirectFromPath(formData.get("fromPath")?.toString());
    const toPath = normalizeRedirectToPath(formData.get("toPath")?.toString());
    const statusCode = parseRedirectStatusCode(formData.get("statusCode")?.toString());
    const isActive = normalizeOptionalBoolean(formData.get("isActive"));
    const note = normalizeOptionalText(formData.get("note"), 280);

    if (!fromPath) return { success: false, message: "Gecerli bir from path girin." };
    if (!toPath) return { success: false, message: "Gecerli bir to path girin." };
    if (fromPath === toPath) return { success: false, message: "Ayni path'e yonlendirme yapilamaz." };

    const hasChainRisk = await hasRedirectChainRisk(fromPath, toPath, id);
    if (hasChainRisk) {
      return { success: false, message: "Redirect chain/loop riski tespit edildi." };
    }

    await prisma.redirectRule.update({
      where: { id },
      data: {
        fromPath,
        toPath,
        statusCode,
        isActive,
        note,
      },
    });

    revalidateContentPaths();
    return { success: true, message: "Redirect kurali guncellendi." };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, message: "Bu from path zaten kullanimda." };
    }
    return { success: false, message: "Redirect kurali guncellenemedi." };
  }
}

export async function deleteRedirectRuleAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz redirect kaydi." };

    await prisma.redirectRule.delete({ where: { id } });
    revalidateContentPaths();
    return { success: true, message: "Redirect kurali silindi." };
  } catch {
    return { success: false, message: "Redirect kurali silinemedi." };
  }
}

export async function uploadMediaAssetAction(formData: FormData): Promise<ActionResultWithId> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, message: "Dosya secilmedi." };

    const stored = await saveMediaFile(file);
    if (!stored.success) {
      return { success: false, message: stored.message };
    }

    const widthInput = parseOptionalPositiveInteger(formData.get("width"));
    const heightInput = parseOptionalPositiveInteger(formData.get("height"));

    const width = widthInput ?? stored.inferredDimensions?.width ?? null;
    const height = heightInput ?? stored.inferredDimensions?.height ?? null;

    const created = await prisma.mediaAsset.create({
      data: {
        title: normalizeOptionalMediaText(formData.get("title"), 160),
        altText: normalizeOptionalMediaText(formData.get("altText"), 220),
        caption: normalizeOptionalMediaText(formData.get("caption"), 420),
        storagePath: stored.storagePath,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        width,
        height,
        createdBy: hq.username,
      },
      select: { id: true },
    });

    revalidateContentPaths();
    return { success: true, message: "Gorsel kutuphaneye eklendi.", id: created.id };
  } catch {
    return { success: false, message: "Gorsel yuklenemedi." };
  }
}

export async function updateMediaAssetAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz media kaydi." };

    await prisma.mediaAsset.update({
      where: { id },
      data: {
        title: normalizeOptionalMediaText(formData.get("title"), 160),
        altText: normalizeOptionalMediaText(formData.get("altText"), 220),
        caption: normalizeOptionalMediaText(formData.get("caption"), 420),
      },
    });

    revalidateContentPaths();
    return { success: true, message: "Media metadatasi guncellendi." };
  } catch {
    return { success: false, message: "Media metadatasi guncellenemedi." };
  }
}

export async function deleteMediaAssetAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const id = parseId(formData.get("id"));
    if (!id) return { success: false, message: "Gecersiz media kaydi." };

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, storagePath: true },
    });
    if (!asset) return { success: false, message: "Media kaydi bulunamadi." };

    await prisma.mediaAsset.delete({ where: { id: asset.id } });
    await removeMediaFile(asset.storagePath);

    revalidateContentPaths();
    return { success: true, message: "Media kaydi silindi." };
  } catch {
    return { success: false, message: "Media kaydi silinemedi." };
  }
}

export async function createContentPreviewLinkAction(input: {
  targetType: ContentPreviewTargetType;
  targetId: number;
  pathname: string;
}): Promise<PreviewLinkActionResult> {
  try {
    const hq = await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });

    if (!Number.isInteger(input.targetId) || input.targetId <= 0) {
      return { success: false, message: "Gecersiz icerik kaydi." };
    }

    const exists =
      input.targetType === "PAGE"
        ? await prisma.page.findUnique({ where: { id: input.targetId }, select: { id: true } })
        : await prisma.blogPost.findUnique({ where: { id: input.targetId }, select: { id: true } });

    if (!exists) {
      return { success: false, message: "Icerik bulunamadi." };
    }

    const issued = await createPreviewToken({
      targetType: input.targetType,
      targetId: input.targetId,
      createdBy: hq.username,
    });

    const previewPath = appendPreviewTokenToPath(input.pathname, issued.token);
    const absoluteUrl = new URL(previewPath, resolveCanonicalAppOrigin()).toString();

    return {
      success: true,
      message: "Preview link olusturuldu.",
      url: absoluteUrl,
      expiresAt: issued.expiresAt.toISOString(),
    };
  } catch {
    return { success: false, message: "Preview link olusturulamadi." };
  }
}

export async function saveHomepageSeoSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const siteConfigId = await ensureMainMarketingSiteId();

    const seoTitle = normalizeOptionalText(formData.get("seoTitle"), 160);
    const seoDescription = normalizeOptionalText(formData.get("metaDescription"), 320);
    const seoCanonicalUrl = normalizeOptionalAbsoluteUrl(formData.get("canonicalUrl"), 320);
    const seoOgTitle = normalizeOptionalText(formData.get("ogTitle"), 160);
    const seoOgDescription = normalizeOptionalText(formData.get("ogDescription"), 320);
    const seoOgImageUrl = normalizeOptionalImageUrl(formData.get("ogImage"), 320);
    const seoRobotsIndex = normalizeOptionalBoolean(formData.get("robotsIndex"));
    const seoRobotsFollow = normalizeOptionalBoolean(formData.get("robotsFollow"));

    await prisma.marketingSiteConfig.update({
      where: { id: siteConfigId },
      data: {
        seoTitle,
        seoDescription,
        seoCanonicalUrl,
        seoOgTitle,
        seoOgDescription,
        seoOgImageUrl,
        seoRobotsIndex,
        seoRobotsFollow,
      },
    });

    revalidateContentPaths();
    return { success: true, message: "Ana sayfa SEO ayarlari kaydedildi." };
  } catch {
    return { success: false, message: "Ana sayfa SEO ayarlari kaydedilemedi." };
  }
}

export async function savePlannedMaintenanceSettingsAction(formData: FormData): Promise<ActionResult> {
  try {
    await assertHqMutationGuard({ capability: "MARKETING_CONTENT_MANAGE" });
    const siteConfigId = await ensureMainMarketingSiteId();

    const plannedMaintenanceEnabled = normalizeOptionalBoolean(
      formData.get("plannedMaintenanceEnabled"),
    );
    const plannedMaintenanceStartsAt = parseOptionalDateTimeInput(
      formData.get("plannedMaintenanceStartsAt"),
    );
    const plannedMaintenanceEndsAt = parseOptionalDateTimeInput(
      formData.get("plannedMaintenanceEndsAt"),
    );
    const plannedMaintenanceMessage = normalizeOptionalText(
      formData.get("plannedMaintenanceMessage"),
      500,
    );
    const plannedMaintenanceAllowedPathsInput = normalizeOptionalText(
      formData.get("plannedMaintenanceAllowedPaths"),
      4_000,
    );
    const allowedPathPrefixes = normalizeMaintenanceAllowedPathPrefixes(
      plannedMaintenanceAllowedPathsInput,
    );

    // Safety: never lock out HQ/login during maintenance.
    const guaranteedPrefixes = ["/hq", "/glidragiris"] as const;
    for (const prefix of guaranteedPrefixes) {
      if (!allowedPathPrefixes.includes(prefix)) {
        allowedPathPrefixes.push(prefix);
      }
    }

    if (plannedMaintenanceEnabled) {
      if (!plannedMaintenanceStartsAt || !plannedMaintenanceEndsAt) {
        return {
          success: false,
          message: "Planli bakim acikken baslangic ve bitis tarihi zorunludur.",
        };
      }
      if (plannedMaintenanceEndsAt.getTime() <= plannedMaintenanceStartsAt.getTime()) {
        return {
          success: false,
          message: "Bakim bitis tarihi, baslangic tarihinden sonra olmalidir.",
        };
      }
    }

    await prisma.marketingSiteConfig.update({
      where: { id: siteConfigId },
      data: {
        plannedMaintenanceEnabled,
        plannedMaintenanceStartsAt: plannedMaintenanceEnabled
          ? plannedMaintenanceStartsAt
          : null,
        plannedMaintenanceEndsAt: plannedMaintenanceEnabled ? plannedMaintenanceEndsAt : null,
        plannedMaintenanceMessage,
        plannedMaintenanceAllowedPaths: allowedPathPrefixes.join("\n"),
      },
    });

    revalidatePath("/");
    revalidatePath("/hq");
    revalidatePath("/hq/settings/maintenance");
    return { success: true, message: "Planli bakim ayarlari kaydedildi." };
  } catch {
    return { success: false, message: "Planli bakim ayarlari kaydedilemedi." };
  }
}
