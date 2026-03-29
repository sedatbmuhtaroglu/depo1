-- CreateEnum
CREATE TYPE "MenuShowcaseAutoplaySpeed" AS ENUM ('SLOW', 'NORMAL');

-- CreateEnum
CREATE TYPE "MenuFrequentShowcasePlacement" AS ENUM ('ABOVE_CATEGORIES', 'BELOW_CATEGORIES', 'STICKY', 'BLOCK');

-- AlterTable
ALTER TABLE "MenuFrequentShowcase" ADD COLUMN     "placement" "MenuFrequentShowcasePlacement" NOT NULL DEFAULT 'BELOW_CATEGORIES';

-- AlterTable
ALTER TABLE "MenuPopularShowcase" ADD COLUMN     "autoplayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoplaySpeed" "MenuShowcaseAutoplaySpeed" NOT NULL DEFAULT 'SLOW';
