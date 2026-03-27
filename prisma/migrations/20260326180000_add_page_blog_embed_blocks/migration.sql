-- AlterTable
ALTER TABLE "Page" ADD COLUMN "embedBlocks" JSONB;

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN "embedBlocks" JSONB;
