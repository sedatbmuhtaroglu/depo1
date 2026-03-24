import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { MarketingHomepageContentForm } from "@/modules/hq/components/marketing-homepage-content-form";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export default async function HqMarketingHomepageContentPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Ana Sayfa Icerigi</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Hero, section basliklari, CTA metinleri, SSS ve liste alanlarini tek merkezden guncelleyin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <MarketingHomepageContentForm site={site} />
      </section>
    </div>
  );
}
