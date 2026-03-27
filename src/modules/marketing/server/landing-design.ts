import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  type LandingPublicDesignV1,
  mergePublicDesignFromDb,
  parseLandingPublicDesign,
} from "@/modules/marketing/landing-public-design";
import { ensureMainMarketingSiteId } from "@/modules/marketing/server/landing-content";

export async function getMergedPublicLandingDesignForPublic() {
  noStore();
  await ensureMainMarketingSiteId();
  const row = await prisma.marketingSiteConfig.findUnique({
    where: { key: "main" },
    select: { landingPublicDesign: true },
  });
  return mergePublicDesignFromDb(row?.landingPublicDesign ?? null);
}

export async function getLandingPublicDesignForHq(): Promise<{
  design: LandingPublicDesignV1;
  updatedAt: Date;
}> {
  noStore();
  await ensureMainMarketingSiteId();
  const row = await prisma.marketingSiteConfig.findUnique({
    where: { key: "main" },
    select: { landingPublicDesign: true, updatedAt: true },
  });
  return {
    design: parseLandingPublicDesign(row?.landingPublicDesign ?? null),
    updatedAt: row?.updatedAt ?? new Date(),
  };
}

export async function saveLandingPublicDesignJson(
  next: LandingPublicDesignV1,
): Promise<void> {
  const siteId = await ensureMainMarketingSiteId();
  await prisma.marketingSiteConfig.update({
    where: { id: siteId },
    data: {
      landingPublicDesign: next as unknown as Prisma.InputJsonValue,
    },
  });
}
