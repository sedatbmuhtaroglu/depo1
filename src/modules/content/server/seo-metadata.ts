import type { Metadata } from "next";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";

export type SeoInput = {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  robotsIndex?: boolean | null;
  robotsFollow?: boolean | null;
};

type BuildMetadataInput = {
  seo: SeoInput;
  fallbackTitle: string;
  fallbackDescription: string;
  pathname?: string;
  type?: "website" | "article";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
};

function normalizeUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) {
    return new URL(raw, resolveBaseUrl()).toString();
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function resolveBaseUrl(): string {
  try {
    return resolveCanonicalAppOrigin();
  } catch {
    return "http://localhost:3000";
  }
}

export function buildAbsoluteUrl(pathname: string): string {
  return new URL(pathname, resolveBaseUrl()).toString();
}

export function resolveCanonicalUrl(pathname: string | undefined, canonicalUrl: string | null | undefined): string | undefined {
  const explicit = normalizeUrl(canonicalUrl);
  if (explicit) return explicit;
  if (!pathname) return undefined;
  return buildAbsoluteUrl(pathname);
}

export function buildMetadataFromSeo(input: BuildMetadataInput): Metadata {
  const title = (input.seo.seoTitle ?? "").trim() || input.fallbackTitle;
  const description = (input.seo.metaDescription ?? "").trim() || input.fallbackDescription;
  const canonical = resolveCanonicalUrl(input.pathname, input.seo.canonicalUrl);
  const ogTitle = (input.seo.ogTitle ?? "").trim() || title;
  const ogDescription = (input.seo.ogDescription ?? "").trim() || description;
  const ogImage = normalizeUrl(input.seo.ogImage);
  const robotsIndex = input.seo.robotsIndex ?? true;
  const robotsFollow = input.seo.robotsFollow ?? true;
  const canonicalOrBase = canonical ?? resolveBaseUrl();

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: input.type ?? "website",
      title: ogTitle,
      description: ogDescription,
      url: canonicalOrBase,
      images: ogImage ? [ogImage] : undefined,
      ...(input.type === "article"
        ? {
            publishedTime: input.publishedTime?.toISOString(),
            modifiedTime: input.modifiedTime?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    robots: {
      index: robotsIndex,
      follow: robotsFollow,
      googleBot: {
        index: robotsIndex,
        follow: robotsFollow,
      },
    },
  };
}

export function buildWebsiteJsonLd(input: {
  name: string;
  description: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    description: input.description,
    url: input.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${input.url.replace(/\/$/, "")}/blog?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildOrganizationJsonLd(input: {
  name: string;
  url: string;
  logo?: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
  };
}

export function buildBlogPostJsonLd(input: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
  datePublished?: Date | null;
  dateModified: Date;
  authorName?: string | null;
  publisherName: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: input.url,
    ...(input.image ? { image: [input.image] } : {}),
    datePublished: (input.datePublished ?? input.dateModified).toISOString(),
    dateModified: input.dateModified.toISOString(),
    author: {
      "@type": "Person",
      name: input.authorName?.trim() || "MENUCY Editorial",
    },
    publisher: {
      "@type": "Organization",
      name: input.publisherName,
    },
  };
}
