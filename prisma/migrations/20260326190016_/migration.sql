-- AlterTable
ALTER TABLE "MarketingLandingTheme" ADD COLUMN     "headerBackground" VARCHAR(24),
ADD COLUMN     "headerBorderColor" VARCHAR(48),
ADD COLUMN     "heroGradientFrom" VARCHAR(24),
ADD COLUMN     "heroGradientTo" VARCHAR(24),
ADD COLUMN     "heroGradientVia" VARCHAR(24);

-- AlterTable
ALTER TABLE "MarketingSiteConfig" ADD COLUMN     "footerConfig" JSONB;
