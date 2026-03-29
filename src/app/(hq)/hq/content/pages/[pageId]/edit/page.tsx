import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { getHqPageById, listHqMediaAssets } from "@/modules/content/server/content-queries";
import { ContentPageForm } from "@/modules/hq/components/content-page-form";

export default async function HqContentPageEditPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const [page, mediaAssets] = await Promise.all([
    getHqPageById(pageId),
    listHqMediaAssets({ limit: 200 }),
  ]);
  if (!page) notFound();

  const baseUrl = resolveCanonicalAppOrigin();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Sayfa Duzenle</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Slug, durum ve SEO alanlarini guncelleyebilirsiniz.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <ContentPageForm mode="edit" baseUrl={baseUrl} initial={page} mediaAssets={mediaAssets} />
      </section>
    </div>
  );
}
