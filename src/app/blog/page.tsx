import type { Metadata } from "next";
import Link from "next/link";
import {
  listPublishedBlogCategoriesForPublic,
  listPublishedBlogPostsForPublic,
} from "@/modules/content/server/content-queries";
import { buildMetadataFromSeo } from "@/modules/content/server/seo-metadata";
import { getMarketingSiteConfigForPublic } from "@/modules/marketing/server/landing-content";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getMarketingSiteConfigForPublic();
  return buildMetadataFromSeo({
    seo: {
      seoTitle: site?.brandName ? `${site.brandName} | Blog` : "Blog",
      metaDescription: "QR menu, restoran operasyonu ve siparis akisina dair guncel yazilar.",
      robotsIndex: true,
      robotsFollow: true,
    },
    fallbackTitle: site?.brandName ? `${site.brandName} | Blog` : "Blog",
    fallbackDescription: "QR menu, restoran operasyonu ve siparis akisina dair guncel yazilar.",
    pathname: "/blog",
    type: "website",
  });
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(value);
}

export default async function BlogIndexPage() {
  const [categories, posts] = await Promise.all([
    listPublishedBlogCategoriesForPublic(),
    listPublishedBlogPostsForPublic({ limit: 60 }),
  ]);

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-14 text-[#f3f7ff] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">Bilgi Merkezi</p>
          <h1 className="text-3xl font-semibold">Blog</h1>
          <p className="max-w-2xl text-sm text-[#94a3b8]">
            Restoran dijitallesmesi, operasyon hizlandirma ve satis odakli menuler icin uygulanabilir icerikler.
          </p>
        </header>

        {categories.length > 0 ? (
          <nav className="flex flex-wrap gap-2">
            <Link href="/blog" className="rounded-full border border-[#243252] bg-[#0f1b33] px-3 py-1.5 text-xs text-[#f3f7ff]">
              Tum Yazilar
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/blog/category/${category.slug}`}
                className="rounded-full border border-[#243252] bg-[#0f1b33] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-[#f3f7ff]"
              >
                {category.name} ({category.postCount})
              </Link>
            ))}
          </nav>
        ) : null}

        {posts.length === 0 ? (
          <section className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-6 text-sm text-[#94a3b8]">
            Yayinda blog yazisi bulunamadi.
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-[#94a3b8]">
                  {post.category?.name ?? "Genel"} - {formatDate(post.publishedAt)} - {post.readingTimeMinutes} dk
                </p>
                <h2 className="mt-2 text-lg font-semibold leading-tight">
                  <Link href={`/blog/${post.slug}`} className="hover:text-[#22c55e]">
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? <p className="mt-2 text-sm text-[#94a3b8]">{post.excerpt}</p> : null}
                <Link href={`/blog/${post.slug}`} className="mt-4 inline-flex text-sm font-medium text-[#22c55e] hover:text-[#16a34a]">
                  Yaziyi oku
                </Link>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
