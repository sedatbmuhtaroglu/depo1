-- CreateTable
CREATE TABLE "MarketingLandingTheme" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "background" VARCHAR(16) NOT NULL,
    "surface" VARCHAR(16) NOT NULL,
    "surfaceAlt" VARCHAR(16) NOT NULL,
    "card" VARCHAR(16) NOT NULL,
    "border" VARCHAR(16) NOT NULL,
    "textPrimary" VARCHAR(16) NOT NULL,
    "textSecondary" VARCHAR(16) NOT NULL,
    "accent" VARCHAR(16) NOT NULL,
    "accentHover" VARCHAR(16) NOT NULL,
    "success" VARCHAR(16) NOT NULL,
    "warning" VARCHAR(16) NOT NULL,
    "heroBadgeBg" VARCHAR(16) NOT NULL,
    "heroBadgeText" VARCHAR(16) NOT NULL,
    "buttonPrimaryBg" VARCHAR(16) NOT NULL,
    "buttonPrimaryText" VARCHAR(16) NOT NULL,
    "buttonSecondaryBg" VARCHAR(16) NOT NULL,
    "buttonSecondaryText" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLandingTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLandingSection" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "sectionType" VARCHAR(64) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eyebrowHtml" TEXT,
    "titleHtml" TEXT,
    "subtitleHtml" TEXT,
    "bodyHtml" TEXT,
    "ctaPrimaryLabelHtml" TEXT,
    "ctaPrimaryHref" VARCHAR(320),
    "ctaSecondaryLabelHtml" TEXT,
    "ctaSecondaryHref" VARCHAR(320),
    "mediaUrl" VARCHAR(320),
    "mediaAlt" VARCHAR(180),
    "mediaCaptionHtml" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLandingSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLandingTheme_siteConfigId_key" ON "MarketingLandingTheme"("siteConfigId");

-- CreateIndex
CREATE INDEX "MarketingLandingSection_siteConfigId_sortOrder_idx" ON "MarketingLandingSection"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLandingSection_siteConfigId_sectionType_key" ON "MarketingLandingSection"("siteConfigId", "sectionType");

-- AddForeignKey
ALTER TABLE "MarketingLandingTheme" ADD CONSTRAINT "MarketingLandingTheme_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLandingSection" ADD CONSTRAINT "MarketingLandingSection_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
