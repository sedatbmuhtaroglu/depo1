import type { ContentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { evaluateSeoCompleteness } from "@/modules/content/server/content-utils";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";

type StatusFilter = ContentStatus | "ALL";
type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

function normalizeSearch(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function parseStatusFilter(value: string | null | undefined): StatusFilter {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "DRAFT" || normalized === "PUBLISHED") {
    return normalized;
  }
  return "ALL";
}

function parseActiveFilter(value: string | null | undefined): ActiveFilter {
  const normalized = (value ?? "").trim().toUpperCase();
  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "INACTIVE") return "INACTIVE";
  return "ALL";
}

function parseIntId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function publishedWhereClause(): Prisma.PageWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };
}

function publishedBlogWhereClause(): Prisma.BlogPostWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };
}

const pagePublicSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  excerpt: true,
  coverImageUrl: true,
  contentHtml: true,
  embedBlocks: true,
  publishedAt: true,
  updatedAt: true,
  authorName: true,
  seoTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  robotsIndex: true,
  robotsFollow: true,
  focusKeyword: true,
} satisfies Prisma.PageSelect;

const blogPublicSelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  excerpt: true,
  contentHtml: true,
  embedBlocks: true,
  featuredImageUrl: true,
  publishedAt: true,
  updatedAt: true,
  authorName: true,
  readingTimeMinutes: true,
  tags: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  seoTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  robotsIndex: true,
  robotsFollow: true,
  focusKeyword: true,
} satisfies Prisma.BlogPostSelect;

export type HqPageListFilters = {
  q?: string | null;
  status?: string | null;
};

export type HqBlogListFilters = {
  q?: string | null;
  status?: string | null;
  category?: string | null;
};

export type HqRedirectListFilters = {
  q?: string | null;
  active?: string | null;
};

export type HqMediaListFilters = {
  q?: string | null;
  limit?: number;
};

export async function listHqPages(filters: HqPageListFilters) {
  const q = normalizeSearch(filters.q);
  const status = parseStatusFilter(filters.status);

  const where: Prisma.PageWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.page.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      seoTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      robotsIndex: true,
      robotsFollow: true,
      coverImageUrl: true,
    },
    take: 300,
  });

  return rows.map((row) => ({
    ...row,
    seo: evaluateSeoCompleteness({
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      canonicalUrl: row.canonicalUrl,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImage: row.ogImage,
      slug: row.slug,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      featuredImageUrl: row.coverImageUrl,
    }),
  }));
}

export async function getHqPageById(pageId: string) {
  const id = parseIntId(pageId);
  if (!id) return null;

  return prisma.page.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      coverImageUrl: true,
      contentHtml: true,
      embedBlocks: true,
      publishedAt: true,
      authorName: true,
      sortOrder: true,
      isHomepageSelectable: true,
      seoTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listHqBlogCategories() {
  return prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: {
        select: { posts: true },
      },
    },
  });
}

export async function listHqBlogPosts(filters: HqBlogListFilters) {
  const q = normalizeSearch(filters.q);
  const status = parseStatusFilter(filters.status);
  const category = parseIntId(filters.category ?? "");

  const where: Prisma.BlogPostWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.blogPost.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
      readingTimeMinutes: true,
      seoTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      robotsIndex: true,
      robotsFollow: true,
      featuredImageUrl: true,
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
    take: 300,
  });

  return rows.map((row) => ({
    ...row,
    seo: evaluateSeoCompleteness({
      seoTitle: row.seoTitle,
      metaDescription: row.metaDescription,
      canonicalUrl: row.canonicalUrl,
      ogTitle: row.ogTitle,
      ogDescription: row.ogDescription,
      ogImage: row.ogImage,
      slug: row.slug,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      featuredImageUrl: row.featuredImageUrl,
    }),
  }));
}

export async function getHqBlogPostById(postId: string) {
  const id = parseIntId(postId);
  if (!id) return null;

  return prisma.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      contentHtml: true,
      embedBlocks: true,
      featuredImageUrl: true,
      publishedAt: true,
      authorName: true,
      categoryId: true,
      tags: true,
      readingTimeMinutes: true,
      canonicalUrl: true,
      seoTitle: true,
      metaDescription: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listHqRedirectRules(filters: HqRedirectListFilters) {
  const q = normalizeSearch(filters.q);
  const active = parseActiveFilter(filters.active);

  return prisma.redirectRule.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { fromPath: { contains: q, mode: "insensitive" } },
              { toPath: { contains: q, mode: "insensitive" } },
              { note: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(active === "ACTIVE" ? { isActive: true } : {}),
      ...(active === "INACTIVE" ? { isActive: false } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      fromPath: true,
      toPath: true,
      statusCode: true,
      isActive: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      createdBy: true,
    },
    take: 400,
  });
}

export async function listHqMediaAssets(filters: HqMediaListFilters = {}) {
  const q = normalizeSearch(filters.q);
  const limit = Math.min(Math.max(filters.limit ?? 200, 20), 600);

  return prisma.mediaAsset.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { altText: { contains: q, mode: "insensitive" } },
            { caption: { contains: q, mode: "insensitive" } },
            { storagePath: { contains: q, mode: "insensitive" } },
            { fileName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      altText: true,
      caption: true,
      storagePath: true,
      fileName: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
      createdBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getHomepageSeoSettingsForHq() {
  const siteConfigId = await ensureMainMarketingSiteId();
  return prisma.marketingSiteConfig.findUnique({
    where: { id: siteConfigId },
    select: {
      id: true,
      brandName: true,
      brandTagline: true,
      seoTitle: true,
      seoDescription: true,
      seoCanonicalUrl: true,
      seoOgTitle: true,
      seoOgDescription: true,
      seoOgImageUrl: true,
      seoRobotsIndex: true,
      seoRobotsFollow: true,
      updatedAt: true,
    },
  });
}

export type HqPlannedMaintenanceSettings = {
  plannedMaintenanceEnabled: boolean;
  plannedMaintenanceStartsAt: Date | null;
  plannedMaintenanceEndsAt: Date | null;
  plannedMaintenanceMessage: string | null;
  plannedMaintenanceAllowedPaths: string | null;
  updatedAt: Date;
};

export const DEFAULT_MAINTENANCE_ALLOWED_PATH_PREFIXES = [
  "/",
  "/hq",
  "/glidragiris",
  "/restaurant",
  "/waiter",
  "/kitchen",
] as const;

export function normalizeMaintenanceAllowedPathPrefixes(rawValue: string | null | undefined): string[] {
  const tokens = (rawValue ?? "")
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  const normalized: string[] = [];
  for (const token of tokens) {
    const value = token
      .replace(/^https?:\/\/[^/]+/i, "")
      .split("?")[0]
      ?.split("#")[0]
      ?.trim();
    if (!value || !value.startsWith("/")) continue;
    const canonical = value === "/" ? "/" : value.replace(/\/+$/, "");
    if (!canonical) continue;
    if (!normalized.includes(canonical)) normalized.push(canonical);
  }

  if (normalized.length === 0) {
    return [...DEFAULT_MAINTENANCE_ALLOWED_PATH_PREFIXES];
  }
  return normalized;
}

export async function getPlannedMaintenanceSettingsForHq(): Promise<HqPlannedMaintenanceSettings | null> {
  noStore();
  const siteConfigId = await ensureMainMarketingSiteId();
  return prisma.marketingSiteConfig.findUnique({
    where: { id: siteConfigId },
    select: {
      plannedMaintenanceEnabled: true,
      plannedMaintenanceStartsAt: true,
      plannedMaintenanceEndsAt: true,
      plannedMaintenanceMessage: true,
      plannedMaintenanceAllowedPaths: true,
      updatedAt: true,
    },
  });
}

export type ActivePlannedMaintenance = {
  startsAt: Date;
  endsAt: Date;
  message: string;
  allowedPathPrefixes: string[];
};

export async function getActivePlannedMaintenance(): Promise<ActivePlannedMaintenance | null> {
  noStore();
  const siteConfigId = await ensureMainMarketingSiteId();
  const row = await prisma.marketingSiteConfig.findUnique({
    where: { id: siteConfigId },
    select: {
      plannedMaintenanceEnabled: true,
      plannedMaintenanceStartsAt: true,
      plannedMaintenanceEndsAt: true,
      plannedMaintenanceMessage: true,
      plannedMaintenanceAllowedPaths: true,
    },
  });

  if (!row?.plannedMaintenanceEnabled) return null;
  if (!row.plannedMaintenanceStartsAt || !row.plannedMaintenanceEndsAt) return null;
  const now = Date.now();
  if (now < row.plannedMaintenanceStartsAt.getTime()) return null;
  if (now > row.plannedMaintenanceEndsAt.getTime()) return null;

  return {
    startsAt: row.plannedMaintenanceStartsAt,
    endsAt: row.plannedMaintenanceEndsAt,
    message: (row.plannedMaintenanceMessage ?? "").trim(),
    allowedPathPrefixes: normalizeMaintenanceAllowedPathPrefixes(
      row.plannedMaintenanceAllowedPaths,
    ),
  };
}

export async function listPublishedPagesForPublic() {
  return prisma.page.findMany({
    where: publishedWhereClause(),
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }, { id: "desc" }],
    select: pagePublicSelect,
  });
}

export async function getPageBySlugForPublicAccess(slug: string) {
  return prisma.page.findFirst({
    where: { slug },
    select: pagePublicSelect,
  });
}

export async function getPublishedPageBySlug(slug: string) {
  return prisma.page.findFirst({
    where: {
      slug,
      ...publishedWhereClause(),
    },
    select: pagePublicSelect,
  });
}

export async function listPublishedBlogCategoriesForPublic() {
  const categories = await prisma.blogCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  });

  const counts = await prisma.blogPost.groupBy({
    by: ["categoryId"],
    where: {
      ...publishedBlogWhereClause(),
      categoryId: { not: null },
    },
    _count: {
      _all: true,
    },
  });

  const countMap = new Map<number, number>();
  for (const row of counts) {
    if (!row.categoryId) continue;
    countMap.set(row.categoryId, row._count._all);
  }

  return categories.map((category) => ({
    ...category,
    postCount: countMap.get(category.id) ?? 0,
  }));
}

export async function listPublishedBlogPostsForPublic(params?: { categorySlug?: string | null; limit?: number }) {
  const categorySlug = normalizeSearch(params?.categorySlug);
  const limit = params?.limit && params.limit > 0 ? params.limit : 50;

  return prisma.blogPost.findMany({
    where: {
      ...publishedBlogWhereClause(),
      ...(categorySlug ? { category: { slug: categorySlug, isActive: true } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      featuredImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      authorName: true,
      readingTimeMinutes: true,
      tags: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      seoTitle: true,
      metaDescription: true,
      canonicalUrl: true,
      ogTitle: true,
      ogDescription: true,
      ogImage: true,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: true,
    },
  });
}

export async function getBlogPostBySlugForPublicAccess(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug },
    select: blogPublicSelect,
  });
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const post = await prisma.blogPost.findFirst({
    where: {
      slug,
      ...publishedBlogWhereClause(),
    },
    select: blogPublicSelect,
  });

  if (!post) return null;

  const related = await prisma.blogPost.findMany({
    where: {
      id: { not: post.id },
      ...publishedBlogWhereClause(),
      ...(post.category?.id ? { categoryId: post.category.id } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImageUrl: true,
      publishedAt: true,
      readingTimeMinutes: true,
      category: {
        select: { name: true, slug: true },
      },
    },
  });

  return {
    ...post,
    related,
  };
}

export async function listSitemapContentUrls() {
  const [pages, posts] = await Promise.all([
    prisma.page.findMany({
      where: publishedWhereClause(),
      select: { slug: true, updatedAt: true },
    }),
    prisma.blogPost.findMany({
      where: publishedBlogWhereClause(),
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return {
    pages,
    posts,
  };
}
