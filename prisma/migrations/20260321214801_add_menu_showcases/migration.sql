-- CreateTable
CREATE TABLE "MenuPopularShowcase" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "subtitle" VARCHAR(320),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPopularShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuPopularShowcaseItem" (
    "id" SERIAL NOT NULL,
    "showcaseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuPopularShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuFrequentShowcase" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "subtitle" VARCHAR(320),
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuFrequentShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuFrequentShowcaseItem" (
    "id" SERIAL NOT NULL,
    "showcaseId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuFrequentShowcaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuPopularShowcase_tenantId_idx" ON "MenuPopularShowcase"("tenantId");

-- CreateIndex
CREATE INDEX "MenuPopularShowcase_menuId_idx" ON "MenuPopularShowcase"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuPopularShowcase_menuId_categoryId_key" ON "MenuPopularShowcase"("menuId", "categoryId");

-- CreateIndex
CREATE INDEX "MenuPopularShowcaseItem_showcaseId_idx" ON "MenuPopularShowcaseItem"("showcaseId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuPopularShowcaseItem_showcaseId_productId_key" ON "MenuPopularShowcaseItem"("showcaseId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuFrequentShowcase_menuId_key" ON "MenuFrequentShowcase"("menuId");

-- CreateIndex
CREATE INDEX "MenuFrequentShowcase_tenantId_idx" ON "MenuFrequentShowcase"("tenantId");

-- CreateIndex
CREATE INDEX "MenuFrequentShowcaseItem_showcaseId_idx" ON "MenuFrequentShowcaseItem"("showcaseId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuFrequentShowcaseItem_showcaseId_productId_key" ON "MenuFrequentShowcaseItem"("showcaseId", "productId");

-- AddForeignKey
ALTER TABLE "MenuPopularShowcase" ADD CONSTRAINT "MenuPopularShowcase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPopularShowcase" ADD CONSTRAINT "MenuPopularShowcase_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPopularShowcase" ADD CONSTRAINT "MenuPopularShowcase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPopularShowcaseItem" ADD CONSTRAINT "MenuPopularShowcaseItem_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "MenuPopularShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuPopularShowcaseItem" ADD CONSTRAINT "MenuPopularShowcaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuFrequentShowcase" ADD CONSTRAINT "MenuFrequentShowcase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuFrequentShowcase" ADD CONSTRAINT "MenuFrequentShowcase_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuFrequentShowcaseItem" ADD CONSTRAINT "MenuFrequentShowcaseItem_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "MenuFrequentShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuFrequentShowcaseItem" ADD CONSTRAINT "MenuFrequentShowcaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
