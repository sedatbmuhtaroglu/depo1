import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingHomepageView } from "@/modules/marketing/components/landing-homepage-view";
import { getMarketingSiteConfigForPublic } from "@/modules/marketing/server/landing-content";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getMarketingSiteConfigForPublic();
  if (!data) {
    return {
      title: "MENUCY",
      description: "MENUCY landing page",
    };
  }

  return {
    title: data.seoTitle ?? data.heroTitle,
    description: data.seoDescription ?? data.heroDescription,
    alternates: data.seoCanonicalUrl
      ? {
          canonical: data.seoCanonicalUrl,
        }
      : undefined,
    openGraph: {
      title: data.seoOgTitle ?? data.seoTitle ?? data.heroTitle,
      description: data.seoOgDescription ?? data.seoDescription ?? data.heroDescription,
      images: data.seoOgImageUrl ? [data.seoOgImageUrl] : undefined,
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getMarketingSiteConfigForPublic();
  const params = await searchParams;
  const headerList = await headers();

  const readSingle = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = readSingle(value);
    if (single) query.set(key, single);
  }

  const landingPath = query.toString() ? `/?${query.toString()}` : "/";

  return (
    <LandingHomepageView
      data={data}
      tracking={{
        utmSource: readSingle(params.utm_source),
        utmMedium: readSingle(params.utm_medium),
        utmCampaign: readSingle(params.utm_campaign),
        utmTerm: readSingle(params.utm_term),
        utmContent: readSingle(params.utm_content),
        landingPath,
        referrer: headerList.get("referer") ?? "",
      }}
    />
  );
}
