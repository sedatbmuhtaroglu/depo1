import type { MetadataRoute } from "next";
import {
  listPublishedBlogCategoriesForPublic,
  listSitemapContentUrls,
} from "@/modules/content/server/content-queries";
import { buildAbsoluteUrl } from "@/modules/content/server/seo-metadata";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [content, categories] = await Promise.all([
    listSitemapContentUrls(),
    listPublishedBlogCategoriesForPublic(),
  ]);

  const entries: MetadataRoute.Sitemap = [
    {
      url: buildAbsoluteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
      lastModified: new Date(),
    },
    {
      url: buildAbsoluteUrl("/blog"),
      changeFrequency: "daily",
      priority: 0.8,
      lastModified: new Date(),
    },
    {
      url: buildAbsoluteUrl("/pages"),
      changeFrequency: "weekly",
      priority: 0.7,
      lastModified: new Date(),
    },
    {
      url: buildAbsoluteUrl("/legal/kullanici-sozlesmesi"),
      changeFrequency: "yearly",
      priority: 0.4,
      lastModified: new Date(),
    },
    {
      url: buildAbsoluteUrl("/legal/kvkk"),
      changeFrequency: "yearly",
      priority: 0.4,
      lastModified: new Date(),
    },
    {
      url: buildAbsoluteUrl("/legal/gizlilik"),
      changeFrequency: "yearly",
      priority: 0.4,
      lastModified: new Date(),
    },
  ];

  for (const category of categories) {
    entries.push({
      url: buildAbsoluteUrl(`/blog/category/${category.slug}`),
      changeFrequency: "weekly",
      priority: 0.6,
      lastModified: new Date(),
    });
  }

  for (const page of content.pages) {
    entries.push({
      url: buildAbsoluteUrl(`/pages/${page.slug}`),
      changeFrequency: "weekly",
      priority: 0.6,
      lastModified: page.updatedAt,
    });
  }

  for (const post of content.posts) {
    entries.push({
      url: buildAbsoluteUrl(`/blog/${post.slug}`),
      changeFrequency: "weekly",
      priority: 0.7,
      lastModified: post.updatedAt,
    });
  }

  return entries;
}
