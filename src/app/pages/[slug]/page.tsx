import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentEmbedBlocksRenderer } from "@/components/content/content-embed-blocks-renderer";
import { getPageBySlugForPublicAccess } from "@/modules/content/server/content-queries";
import { normalizeEmbedBlocksForRender } from "@/modules/content/shared/embed-blocks";
import { validatePreviewToken } from "@/modules/content/server/preview-token";
import { buildMetadataFromSeo } from "@/modules/content/server/seo-metadata";

type Params = { slug: string };

type SearchParams = Record<string, string | string[] | undefined>;

function pickFirst(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isPublished(status: "DRAFT" | "PUBLISHED", publishedAt: Date | null): boolean {
  if (status !== "PUBLISHED") return false;
  if (!publishedAt) return true;
  return publishedAt <= new Date();
}

async function resolvePageForAccess(slug: string, previewToken: string) {
  const page = await getPageBySlugForPublicAccess(slug);
  if (!page) return { page: null, preview: false };

  if (isPublished(page.status, page.publishedAt)) {
    return { page, preview: false };
  }

  const allowed = await validatePreviewToken({
    targetType: "PAGE",
    targetId: page.id,
    token: previewToken,
  });

  if (!allowed) return { page: null, preview: false };
  return { page, preview: true };
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

  const resolved = await resolvePageForAccess(slug, previewToken);
  if (!resolved.page) {
    return {
      title: "Sayfa Bulunamadi",
      description: "Istenen sayfa yayinda degil veya mevcut degil.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const page = resolved.page;

  return buildMetadataFromSeo({
    seo: {
      seoTitle: page.seoTitle,
      metaDescription: page.metaDescription,
      canonicalUrl: resolved.preview ? undefined : page.canonicalUrl,
      ogTitle: page.ogTitle,
      ogDescription: page.ogDescription,
      ogImage: page.ogImage,
      robotsIndex: resolved.preview ? false : page.robotsIndex,
      robotsFollow: resolved.preview ? false : page.robotsFollow,
    },
    fallbackTitle: page.title,
    fallbackDescription: page.excerpt ?? page.title,
    pathname: `/pages/${page.slug}`,
    type: "website",
    modifiedTime: page.updatedAt,
    publishedTime: page.publishedAt,
  });
}

function formatDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(value);
}

export default async function PublicPageDetail({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const search = await searchParams;
  const previewToken = pickFirst(search.preview);

  const resolved = await resolvePageForAccess(slug, previewToken);
  if (!resolved.page) notFound();

  const page = resolved.page;
  const publishText = formatDate(page.publishedAt);
  const embedBlocks = normalizeEmbedBlocksForRender(page.embedBlocks);

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-12 text-[#f3f7ff] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-[#243252] bg-[#0f1b33] p-6 sm:p-8">
        {resolved.preview ? (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            Taslak onizleme modundasiniz. Bu icerik herkese acik degildir.
          </div>
        ) : null}

        <header className="space-y-3">
          <h1 className="text-3xl font-semibold">{page.title}</h1>
          {page.excerpt ? <p className="text-base text-[#94a3b8]">{page.excerpt}</p> : null}
          {publishText ? <p className="text-xs uppercase tracking-[0.18em] text-[#94a3b8]">Yayin: {publishText}</p> : null}
        </header>

        {page.coverImageUrl ? (
          <img src={page.coverImageUrl} alt={page.title} className="h-64 w-full rounded-2xl object-cover" />
        ) : null}

        <div
          className="space-y-4 text-sm leading-7 text-[#f3f7ff] [&_a]:text-[#22c55e] [&_h2]:text-xl [&_h3]:text-lg [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: page.contentHtml }}
        />

        <ContentEmbedBlocksRenderer blocks={embedBlocks} />
      </article>
    </main>
  );
}
