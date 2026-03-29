import { cardClasses } from "@/lib/ui/button-variants";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { listHqMediaAssets } from "@/modules/content/server/content-queries";
import { ContentPageForm } from "@/modules/hq/components/content-page-form";

export default async function HqContentPageCreatePage() {
  const [baseUrl, mediaAssets] = await Promise.all([
    Promise.resolve(resolveCanonicalAppOrigin()),
    listHqMediaAssets({ limit: 200 }),
  ]);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Yeni Sayfa</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Taslak veya yayinda bir sayfa olusturun; SEO panelinden arama gorunumunu duzenleyin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <ContentPageForm mode="create" baseUrl={baseUrl} mediaAssets={mediaAssets} />
      </section>
    </div>
  );
}
