-- CreateEnum
CREATE TYPE "MarketingSubmissionSource" AS ENUM ('LANDING_HOMEPAGE', 'LANDING_CTA', 'LANDING_FOOTER');

-- CreateEnum
CREATE TYPE "MarketingSubmissionStatus" AS ENUM ('RECEIVED', 'LEAD_CREATED', 'LEAD_CREATE_FAILED', 'SPAM_REJECTED');

-- CreateTable
CREATE TABLE "MarketingSiteConfig" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'main',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "brandName" TEXT NOT NULL DEFAULT '?atal App',
    "brandTagline" VARCHAR(180),
    "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "announcementText" VARCHAR(240),
    "announcementCtaLabel" VARCHAR(80),
    "announcementCtaHref" VARCHAR(220),
    "heroKicker" VARCHAR(120),
    "heroTitle" VARCHAR(180) NOT NULL,
    "heroDescription" VARCHAR(600) NOT NULL,
    "heroPrimaryCtaLabel" VARCHAR(80) NOT NULL,
    "heroPrimaryCtaHref" VARCHAR(220) NOT NULL,
    "heroSecondaryCtaLabel" VARCHAR(80),
    "heroSecondaryCtaHref" VARCHAR(220),
    "trustSectionTitle" VARCHAR(120),
    "trustSectionDescription" VARCHAR(320),
    "featuresSectionTitle" VARCHAR(120),
    "featuresSectionDescription" VARCHAR(320),
    "howItWorksSectionTitle" VARCHAR(120),
    "howItWorksSectionDescription" VARCHAR(320),
    "categorySectionTitle" VARCHAR(120),
    "categorySectionDescription" VARCHAR(320),
    "ctaSectionTitle" VARCHAR(140),
    "ctaSectionDescription" VARCHAR(320),
    "ctaPrimaryLabel" VARCHAR(80),
    "ctaPrimaryHref" VARCHAR(220),
    "faqSectionTitle" VARCHAR(120),
    "faqSectionDescription" VARCHAR(320),
    "formSectionTitle" VARCHAR(140) NOT NULL,
    "formSectionDescription" VARCHAR(320),
    "formSubmitLabel" VARCHAR(80) NOT NULL,
    "formConsentText" VARCHAR(280),
    "seoTitle" VARCHAR(160),
    "seoDescription" VARCHAR(320),
    "seoCanonicalUrl" VARCHAR(320),
    "seoOgTitle" VARCHAR(160),
    "seoOgDescription" VARCHAR(320),
    "seoOgImageUrl" VARCHAR(320),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingTrustBadge" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sublabel" VARCHAR(220),
    "iconName" VARCHAR(64),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTrustBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLogo" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "logoUrl" VARCHAR(320) NOT NULL,
    "targetUrl" VARCHAR(320),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingLogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFeature" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(420) NOT NULL,
    "iconName" VARCHAR(64),
    "ctaLabel" VARCHAR(80),
    "ctaHref" VARCHAR(220),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingHowItWorksStep" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(420) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingHowItWorksStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCategory" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(320),
    "iconName" VARCHAR(64),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSubcategory" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(320),
    "ctaLabel" VARCHAR(80),
    "ctaHref" VARCHAR(220),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFaq" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER NOT NULL,
    "question" VARCHAR(220) NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingFormSubmission" (
    "id" SERIAL NOT NULL,
    "siteConfigId" INTEGER,
    "source" "MarketingSubmissionSource" NOT NULL DEFAULT 'LANDING_HOMEPAGE',
    "status" "MarketingSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "contactName" VARCHAR(120) NOT NULL,
    "businessName" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(180),
    "city" VARCHAR(120),
    "message" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "utmSource" VARCHAR(120),
    "utmMedium" VARCHAR(120),
    "utmCampaign" VARCHAR(120),
    "utmTerm" VARCHAR(120),
    "utmContent" VARCHAR(120),
    "landingPath" VARCHAR(220),
    "referrer" VARCHAR(320),
    "ipHash" VARCHAR(128),
    "userAgentHash" VARCHAR(128),
    "leadId" INTEGER,
    "failureReason" VARCHAR(280),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSiteConfig_key_key" ON "MarketingSiteConfig"("key");

-- CreateIndex
CREATE INDEX "MarketingTrustBadge_siteConfigId_sortOrder_idx" ON "MarketingTrustBadge"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingLogo_siteConfigId_sortOrder_idx" ON "MarketingLogo"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingFeature_siteConfigId_sortOrder_idx" ON "MarketingFeature"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingHowItWorksStep_siteConfigId_sortOrder_idx" ON "MarketingHowItWorksStep"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingCategory_siteConfigId_sortOrder_idx" ON "MarketingCategory"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCategory_siteConfigId_slug_key" ON "MarketingCategory"("siteConfigId", "slug");

-- CreateIndex
CREATE INDEX "MarketingSubcategory_categoryId_sortOrder_idx" ON "MarketingSubcategory"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubcategory_categoryId_slug_key" ON "MarketingSubcategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "MarketingFaq_siteConfigId_sortOrder_idx" ON "MarketingFaq"("siteConfigId", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketingFormSubmission_status_createdAt_idx" ON "MarketingFormSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingFormSubmission_leadId_idx" ON "MarketingFormSubmission"("leadId");

-- CreateIndex
CREATE INDEX "MarketingFormSubmission_source_createdAt_idx" ON "MarketingFormSubmission"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingTrustBadge" ADD CONSTRAINT "MarketingTrustBadge_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLogo" ADD CONSTRAINT "MarketingLogo_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFeature" ADD CONSTRAINT "MarketingFeature_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingHowItWorksStep" ADD CONSTRAINT "MarketingHowItWorksStep_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCategory" ADD CONSTRAINT "MarketingCategory_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSubcategory" ADD CONSTRAINT "MarketingSubcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFaq" ADD CONSTRAINT "MarketingFaq_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFormSubmission" ADD CONSTRAINT "MarketingFormSubmission_siteConfigId_fkey" FOREIGN KEY ("siteConfigId") REFERENCES "MarketingSiteConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingFormSubmission" ADD CONSTRAINT "MarketingFormSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_expir_" RENAME TO "StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_ex_idx";
