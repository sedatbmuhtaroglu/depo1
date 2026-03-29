/*
  Warnings:

  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CashOrderAdjustmentType" AS ENUM ('PARTIAL_CANCEL', 'PARTIAL_RETURN');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "CashOrderAdjustment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderItemId" INTEGER,
    "productId" INTEGER NOT NULL,
    "adjustedQuantity" INTEGER NOT NULL,
    "unitPriceSnapshot" DECIMAL(10,2) NOT NULL,
    "totalAmountDelta" DECIMAL(10,2) NOT NULL,
    "reason" VARCHAR(512),
    "actionType" "CashOrderAdjustmentType" NOT NULL,
    "actorUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOrderAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashOrderAdjustment_tenantId_orderId_idx" ON "CashOrderAdjustment"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "CashOrderAdjustment_tenantId_productId_idx" ON "CashOrderAdjustment"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "CashOrderAdjustment_tenantId_createdAt_idx" ON "CashOrderAdjustment"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "CashOrderAdjustment" ADD CONSTRAINT "CashOrderAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOrderAdjustment" ADD CONSTRAINT "CashOrderAdjustment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOrderAdjustment" ADD CONSTRAINT "CashOrderAdjustment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "TenantStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
