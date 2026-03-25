import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses, cardClasses } from "@/lib/ui/button-variants";
import { MarketingLandingBuilderForm } from "@/modules/hq/components/marketing-landing-builder-form";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export default async function HqMarketingBuilderPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5 flex items-center justify-between gap-4" })}>
        <div>
          <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Landing Builder / CMS</h2>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Theme tokenlari, section sirasi, ac/kapat ve tum metinleri tek schema-driven panelde yonetin.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/hq/marketing/builder/preview"
            target="_blank"
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Preview (New Tab)
          </Link>
          <Link
            href="/"
            target="_blank"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Public Site
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <MarketingLandingBuilderForm site={site} />
      </section>
    </div>
  );
}
