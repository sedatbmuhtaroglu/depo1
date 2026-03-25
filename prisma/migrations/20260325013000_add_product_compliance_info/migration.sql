-- CreateEnum
CREATE TYPE "ProductComplianceStatus" AS ENUM ('YES', 'NO', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "ProductAllergen" AS ENUM (
  'CEREALS_CONTAINING_GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'PEANUTS',
  'SOYBEANS',
  'MILK',
  'TREE_NUTS',
  'CELERY',
  'MUSTARD',
  'SESAME',
  'SULPHUR_DIOXIDE_AND_SULPHITES',
  'LUPIN',
  'MOLLUSCS'
);

-- CreateTable
CREATE TABLE "ProductComplianceInfo" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "basicIngredients" TEXT,
    "caloriesKcal" INTEGER,
    "allergens" "ProductAllergen"[] NOT NULL DEFAULT ARRAY[]::"ProductAllergen"[],
    "customAllergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "alcoholStatus" "ProductComplianceStatus" NOT NULL DEFAULT 'UNSPECIFIED',
    "porkStatus" "ProductComplianceStatus" NOT NULL DEFAULT 'UNSPECIFIED',
    "crossContaminationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductComplianceInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductComplianceInfo_productId_key" ON "ProductComplianceInfo"("productId");

-- AddForeignKey
ALTER TABLE "ProductComplianceInfo"
ADD CONSTRAINT "ProductComplianceInfo_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
