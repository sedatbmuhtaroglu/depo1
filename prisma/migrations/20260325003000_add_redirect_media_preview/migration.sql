-- CreateEnum
CREATE TYPE "ContentPreviewTargetType" AS ENUM ('PAGE', 'BLOG_POST');

-- CreateTable
CREATE TABLE "RedirectRule" (
    "id" SERIAL NOT NULL,
    "fromPath" VARCHAR(320) NOT NULL,
    "toPath" VARCHAR(520) NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" VARCHAR(280),
    "createdBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedirectRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(160),
    "altText" VARCHAR(220),
    "caption" VARCHAR(420),
    "storagePath" VARCHAR(320) NOT NULL,
    "fileName" VARCHAR(220) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdBy" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPreviewToken" (
    "id" SERIAL NOT NULL,
    "targetType" "ContentPreviewTargetType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "createdBy" VARCHAR(120),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentPreviewToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedirectRule_fromPath_key" ON "RedirectRule"("fromPath");

-- CreateIndex
CREATE INDEX "RedirectRule_isActive_updatedAt_idx" ON "RedirectRule"("isActive", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storagePath_key" ON "MediaAsset"("storagePath");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPreviewToken_tokenHash_key" ON "ContentPreviewToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ContentPreviewToken_targetType_targetId_expiresAt_idx" ON "ContentPreviewToken"("targetType", "targetId", "expiresAt");
