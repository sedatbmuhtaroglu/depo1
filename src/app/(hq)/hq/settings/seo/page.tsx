import { cardClasses } from "@/lib/ui/button-variants";
import { resolveCanonicalAppOrigin } from "@/lib/security/allowed-origins";
import { getHomepageSeoSettingsForHq, listHqMediaAssets } from "@/modules/content/server/content-queries";
import { HomepageSeoForm } from "@/modules/hq/components/homepage-seo-form";

export default async function HqHomepageSeoSettingsPage() {
  const [settings, mediaAssets] = await Promise.all([
    getHomepageSeoSettingsForHq(),
    listHqMediaAssets({ limit: 200 }),
  ]);
  if (!settings) {
    return (
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Ana Sayfa SEO</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">SEO ayarlari yuklenemedi.</p>
      </section>
    );
  }

  const baseUrl = resolveCanonicalAppOrigin();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Ana Sayfa SEO</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Home metadata, robots ve Google arama onizlemesini tek panelden yonetin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <HomepageSeoForm baseUrl={baseUrl} initial={settings} mediaAssets={mediaAssets} />
      </section>
    </div>
  );
}
