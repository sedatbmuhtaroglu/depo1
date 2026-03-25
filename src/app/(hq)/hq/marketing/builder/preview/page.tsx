import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { LandingHomepageView } from "@/modules/marketing/components/landing-homepage-view";
import { getMarketingSiteConfigForHq } from "@/modules/marketing/server/landing-content";

export const dynamic = "force-dynamic";

export default async function MarketingPreviewPage() {
  const site = await getMarketingSiteConfigForHq();
  if (!site) notFound();

  const headerList = await headers();
  const referrer = headerList.get("referer") ?? "";

  return (
    <div className="relative">
      <div className="sticky top-0 z-[100] bg-amber-500 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-950 shadow-sm">
        Preview Mode - Veriler DB'den (taslak dahil) anlik okunuyor
      </div>
      <LandingHomepageView
        data={site as any}
        tracking={{
          utmSource: "preview",
          utmMedium: "preview",
          utmCampaign: "preview",
          utmTerm: "",
          utmContent: "",
          landingPath: "/preview",
          referrer,
        }}
      />
    </div>
  );
}
