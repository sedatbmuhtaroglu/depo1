import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { MarketingGeneralSettingsForm } from "@/modules/hq/components/marketing-general-settings-form";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export default async function HqMarketingSettingsPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Genel Ayarlar</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Marka bilgisi, yayin durumu ve SEO alanlarini yonetin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <MarketingGeneralSettingsForm site={site} />
      </section>
    </div>
  );
}
