import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { MarketingCategoriesForm } from "@/modules/hq/components/marketing-categories-form";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export default async function HqMarketingCategoriesPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Kategoriler / Alt Kategoriler</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Landingdeki kategori bloklarini ve alt kullanim alanlarini slug tabanli olarak yonetin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <MarketingCategoriesForm site={site} />
      </section>
    </div>
  );
}
