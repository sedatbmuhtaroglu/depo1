import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBlogPostBySlugForPublicAccess,
  getPublishedBlogPostBySlug,
} from "@/modules/content/server/content-queries";
import { validatePreviewToken } from "@/modules/content/server/preview-token";
import {
  buildAbsoluteUrl,
  buildBlogPostJsonLd,
  buildMetadataFromSeo,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
} from "@/modules/content/server/seo-metadata";
import { getMarketingSiteConfigForPublic } from "@/modules/marketing/server/landing-content";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
  }).format(value);
}

function isPublished(status: "DRAFT" | "PUBLISHED", publishedAt: Date | null): boolean {
  if (status !== "PUBLISHED") return false;
  if (!publishedAt) return true;
  return publishedAt <= new Date();
}

async function resolveBlogPostForAccess(slug: string, previewToken: string) {
  const published = await getPublishedBlogPostBySlug(slug);
  if (published) {
    return { post: published, preview: false };
  }

  const draftCandidate = await getBlogPostBySlugForPublicAccess(slug);
  if (!draftCandidate) return { post: null, preview: false };

  if (isPublished(draftCandidate.status, draftCandidate.publishedAt)) {
    return {
      post: {
        ...draftCandidate,
        related: [],
      },
      preview: false,
    };
  }

  const allowed = await validatePreviewToken({
    targetType: "BLOG_POST",
    targetId: draftCandidate.id,
    token: previewToken,
  });

  if (!allowed) return { post: null, preview: false };

  return {
    post: {
      ...draftCandidate,
      related: [],
    },
    preview: true,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const search = await searchParams;
  const previewToken = pickFirst(search.preview);

  const resolved = await resolveBlogPostForAccess(slug, previewToken);
  if (!resolved.post) {
    return {
      title: "Yazi Bulunamadi",
      description: "Istenen blog yazisi yayinda degil veya mevcut degil.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const post = resolved.post;

  return buildMetadataFromSeo({
    seo: {
      seoTitle: post.seoTitle,
      metaDescription: post.metaDescription,
      canonicalUrl: resolved.preview ? undefined : post.canonicalUrl,
      ogTitle: post.ogTitle,
      ogDescription: post.ogDescription,
      ogImage: post.ogImage,
      robotsIndex: resolved.preview ? false : post.robotsIndex,
      robotsFollow: resolved.preview ? false : post.robotsFollow,
    },
    fallbackTitle: post.title,
    fallbackDescription: post.excerpt ?? post.title,
    pathname: `/blog/${post.slug}`,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

export default async function BlogPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const previewToken = pickFirst(search.preview);

  const [resolved, site] = await Promise.all([
    resolveBlogPostForAccess(slug, previewToken),
    getMarketingSiteConfigForPublic(),
  ]);

  if (!resolved.post) notFound();

  const post = resolved.post;
  const publisherName = site?.brandName ?? "MENUCY";
  const postUrl = buildAbsoluteUrl(`/blog/${post.slug}`);

  const articleJsonLd = buildBlogPostJsonLd({
    title: post.title,
    description: post.metaDescription ?? post.excerpt ?? post.title,
    url: postUrl,
    image: post.ogImage ?? post.featuredImageUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    authorName: post.authorName,
    publisherName,
  });

  const websiteJsonLd = buildWebsiteJsonLd({
    name: publisherName,
    description: site?.seoDescription ?? site?.brandTagline ?? "MENUCY blog ve urun rehberi",
    url: buildAbsoluteUrl("/"),
  });

  const orgJsonLd = buildOrganizationJsonLd({
    name: publisherName,
    url: buildAbsoluteUrl("/"),
    logo: site?.seoOgImageUrl ?? null,
  });

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-12 text-[#f3f7ff] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-[#243252] bg-[#0f1b33] p-6 sm:p-8">
        {resolved.preview ? (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            Taslak onizleme modundasiniz. Bu yazi herkese acik degildir.
          </div>
        ) : null}

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[#94a3b8]">
            {post.category?.name ?? "Genel"} - {formatDate(post.publishedAt)} - {post.readingTimeMinutes} dk
          </p>
          <h1 className="text-3xl font-semibold leading-tight">{post.title}</h1>
          {post.excerpt ? <p className="text-base text-[#94a3b8]">{post.excerpt}</p> : null}
        </header>

        {post.featuredImageUrl ? (
          <img src={post.featuredImageUrl} alt={post.title} className="h-72 w-full rounded-2xl object-cover" />
        ) : null}

        <div
          className="space-y-4 text-sm leading-7 text-[#f3f7ff] [&_a]:text-[#22c55e] [&_h2]:text-xl [&_h3]:text-lg [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {post.related.length > 0 ? (
          <section className="space-y-3 border-t border-[#243252] pt-6">
            <h2 className="text-lg font-semibold">Ilgili Yazilar</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {post.related.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#243252] bg-[#16233f] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#94a3b8]">
                    {item.category?.name ?? "Genel"} - {item.readingTimeMinutes} dk
                  </p>
                  <h3 className="mt-2 text-base font-semibold">
                    <Link href={`/blog/${item.slug}`} className="hover:text-[#22c55e]">
                      {item.title}
                    </Link>
                  </h3>
                  {item.excerpt ? <p className="mt-1 text-sm text-[#94a3b8]">{item.excerpt}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </article>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
    </main>
  );
}
