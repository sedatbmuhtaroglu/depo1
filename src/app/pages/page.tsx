import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPagesForPublic } from "@/modules/content/server/content-queries";
import { buildMetadataFromSeo } from "@/modules/content/server/seo-metadata";
import { getMergedPublicLandingDesignForPublic } from "@/modules/marketing/server/landing-design";

export async function generateMetadata(): Promise<Metadata> {
  const design = await getMergedPublicLandingDesignForPublic();
  const brand = design.general.brandName;
  return buildMetadataFromSeo({
    seo: {
      seoTitle: `${brand} | Sayfalar`,
      metaDescription: "Kurumsal ve bilgilendirici icerik sayfalari.",
      robotsIndex: true,
      robotsFollow: true,
    },
    fallbackTitle: `${brand} | Sayfalar`,
    fallbackDescription: "Kurumsal ve bilgilendirici icerik sayfalari.",
    pathname: "/pages",
    type: "website",
  });
}

export default async function PublicPagesIndexPage() {
  const pages = await listPublishedPagesForPublic();

  return (
    <main className="min-h-screen bg-[#020817] px-4 py-14 text-[#f3f7ff] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#94a3b8]">Icerik</p>
          <h1 className="text-3xl font-semibold">Sayfalar</h1>
          <p className="max-w-2xl text-sm text-[#94a3b8]">
            Yayinda olan tum kurumsal icerik sayfalarini buradan inceleyebilirsiniz.
          </p>
        </header>

        {pages.length === 0 ? (
          <section className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-6 text-sm text-[#94a3b8]">
            Yayinda sayfa bulunamadi.
          </section>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {pages.map((page) => (
              <article key={page.id} className="rounded-2xl border border-[#243252] bg-[#0f1b33] p-5">
                <h2 className="text-lg font-semibold">
                  <Link href={`/pages/${page.slug}`} className="hover:underline">
                    {page.title}
                  </Link>
                </h2>
                {page.excerpt ? <p className="mt-2 text-sm text-[#94a3b8]">{page.excerpt}</p> : null}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
