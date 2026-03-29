-- CreateTable
CREATE TABLE "MarketingLandingNavItem" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "slug" VARCHAR(72) NOT NULL,
    "href" VARCHAR(320) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "badgeText" VARCHAR(64),
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLandingNavItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLandingNavSubitem" (
    "id" SERIAL NOT NULL,
    "navItemId" INTEGER NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "href" VARCHAR(320) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "badgeText" VARCHAR(64),
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLandingNavSubitem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLandingNavItem_siteConfigId_slug_key" ON "MarketingLandingNavItem"("siteConfigId", "slug");

-- CreateIndex
CREATE INDEX "MarketingLandingNavItem_siteConfigId_sortOrder_idx" ON "MarketingLandingNavItem"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingLandingNavSubitem_navItemId_sortOrder_idx" ON "MarketingLandingNavSubitem"("navItemId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MarketingLandingNavItem" ADD CONSTRAINT "MarketingLandingNavItem_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLandingNavSubitem" ADD CONSTRAINT "MarketingLandingNavSubitem_navItemId_fkey" FOREIGN KEY ("navItemId") REFERENCES "MarketingLandingNavItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
