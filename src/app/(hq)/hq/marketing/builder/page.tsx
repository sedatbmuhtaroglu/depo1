import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { MarketingLandingBuilderForm } from "@/modules/hq/components/marketing-landing-builder-form";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export default async function HqMarketingBuilderPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Landing Builder / CMS</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Theme tokenlari, section sirasi, ac/kapat ve tum metinleri tek schema-driven panelde yonetin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <MarketingLandingBuilderForm site={site} />
      </section>
    </div>
  );
}
