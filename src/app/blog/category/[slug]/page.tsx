import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listPublishedBlogCategoriesForPublic,
  listPublishedBlogPostsForPublic,
} from "@/modules/content/server/content-queries";
import { buildMetadataFromSeo } from "@/modules/content/server/seo-metadata";

type Params = { slug: string };

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await listPublishedBlogCategoriesForPublic();
  const category = categories.find((item) => item.slug === slug);
  if (!category) {
    return {
      title: "Kategori Bulunamadi",
      description: "Istenen blog kategorisi bulunamadi.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildMetadataFromSeo({
    seo: {
      seoTitle: `${category.name} | Blog`,
      metaDescription: category.description ?? `${category.name} kategorisindeki yazilar.`,
      robotsIndex: true,
      robotsFollow: true,
    },
    fallbackTitle: `${category.name} | Blog`,
    fallbackDescription: category.description ?? `${category.name} kategorisindeki yazilar.`,
    pathname: `/blog/category/${category.slug}`,
    type: "website",
  });
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  const [categories, posts] = await Promise.all([
    listPublishedBlogCategoriesForPublic(),
    listPublishedBlogPostsForPublic({ categorySlug: slug, limit: 60 }),
  ]);

  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-14 text-[#f3f7ff] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">Blog Kategori</p>
          <h1 className="text-3xl font-semibold">{category.name}</h1>
          {category.description ? <p className="max-w-2xl text-sm text-[#94a3b8]">{category.description}</p> : null}
          <Link href="/blog" className="inline-flex text-sm font-medium text-[#22c55e] hover:text-[#16a34a]">
            Tum yazilara don
          </Link>
        </header>

        {posts.length === 0 ? (
          <section className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-6 text-sm text-[#94a3b8]">
            Bu kategoride yayinda yazi bulunamadi.
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-[#94a3b8]">
                  {formatDate(post.publishedAt)} - {post.readingTimeMinutes} dk
                </p>
                <h2 className="mt-2 text-lg font-semibold leading-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:text-[#22c55e]">
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? <p className="mt-2 text-sm text-[#94a3b8]">{post.excerpt}</p> : null}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
