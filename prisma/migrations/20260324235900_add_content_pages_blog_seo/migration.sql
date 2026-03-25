-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "MarketingSiteConfig"
ADD COLUMN "seoRobotsFollow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "seoRobotsIndex" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Page" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "excerpt" VARCHAR(420),
    "coverImageUrl" VARCHAR(320),
    "contentHtml" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "authorName" VARCHAR(120),
    "authorId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHomepageSelectable" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" VARCHAR(160),
    "metaDescription" VARCHAR(320),
    "canonicalUrl" VARCHAR(320),
    "ogTitle" VARCHAR(160),
    "ogDescription" VARCHAR(320),
    "ogImage" VARCHAR(320),
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "focusKeyword" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(320),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "excerpt" VARCHAR(420),
    "contentHtml" TEXT NOT NULL,
    "featuredImageUrl" VARCHAR(320),
    "publishedAt" TIMESTAMP(3),
    "authorName" VARCHAR(120),
    "authorId" INTEGER,
    "categoryId" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readingTimeMinutes" INTEGER NOT NULL DEFAULT 1,
    "canonicalUrl" VARCHAR(320),
    "seoTitle" VARCHAR(160),
    "metaDescription" VARCHAR(320),
    "ogTitle" VARCHAR(160),
    "ogDescription" VARCHAR(320),
    "ogImage" VARCHAR(320),
    "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
    "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
    "focusKeyword" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE INDEX "Page_status_publishedAt_idx" ON "Page"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Page_updatedAt_idx" ON "Page"("updatedAt");

-- CreateIndex
CREATE INDEX "Page_sortOrder_idx" ON "Page"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateIndex
CREATE INDEX "BlogCategory_sortOrder_idx" ON "BlogCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "BlogCategory_isActive_idx" ON "BlogCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_categoryId_status_publishedAt_idx" ON "BlogPost"("categoryId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_updatedAt_idx" ON "BlogPost"("updatedAt");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
