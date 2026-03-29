import type { MetadataRoute } from "next";
import { buildAbsoluteUrl } from "@/modules/content/server/seo-metadata";
import { getHomepageSeoSettingsForHq } from "@/modules/content/server/content-queries";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config = await getHomepageSeoSettingsForHq();
  const index = config?.seoRobotsIndex ?? true;
  const follow = config?.seoRobotsFollow ?? true;

  const rules: MetadataRoute.Robots["rules"] =
    index && follow
      ? {
          userAgent: "*",
          allow: "/",
          disallow: ["/hq", "/api", "/restaurant", "/waiter", "/kitchen"],
        }
      : {
          userAgent: "*",
          disallow: "/",
        };

  return {
    rules,
    sitemap: buildAbsoluteUrl("/sitemap.xml"),
    host: buildAbsoluteUrl("/"),
  };
}
