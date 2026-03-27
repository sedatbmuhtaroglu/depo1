import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { landingSeo } from "@/content/landing";
import { resolveTenantSlugFromHostname } from "@/lib/tenancy/resolve";
import { LandingHomepageView } from "@/modules/marketing/components/landing-homepage-view";
import { getMergedPublicLandingDesignForPublic } from "@/modules/marketing/server/landing-design";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: landingSeo.title,
    description: landingSeo.description,
    alternates: landingSeo.canonicalUrl
      ? {
          canonical: landingSeo.canonicalUrl,
        }
      : undefined,
    openGraph: {
      title: landingSeo.ogTitle ?? landingSeo.title,
      description: landingSeo.ogDescription ?? landingSeo.description,
      images: landingSeo.ogImageUrl ? [landingSeo.ogImageUrl] : undefined,
    },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const headerList = await headers();
  const requestHostRaw = headerList.get("host") ?? headerList.get("x-forwarded-host") ?? "";
  const requestHost = requestHostRaw.split(",")[0]?.trim().toLowerCase() ?? "";
  const tenantSlug = resolveTenantSlugFromHostname(requestHost);

  // Fallback redirect from marketing root when middleware headers are unavailable in dev.
  if (tenantSlug) {
    redirect("/menu");
  }

  const readSingle = (value: string | string[] | undefined): string =>
    Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = readSingle(value);
    if (single) query.set(key, single);
  }

  const landingPath = query.toString() ? `/?${query.toString()}` : "/";

  const design = await getMergedPublicLandingDesignForPublic();

  return (
    <LandingHomepageView
      design={design}
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
