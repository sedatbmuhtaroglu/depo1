-- CreateEnum
CREATE TYPE "CommercialSaleType" AS ENUM ('DIRECT_PURCHASE', 'TRIAL_CONVERSION');

-- CreateEnum
CREATE TYPE "CommercialPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "CommercialOperationalStatus" AS ENUM ('DRAFT', 'WON', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommercialPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateTable
CREATE TABLE "CommercialRecord" (
  "id" SERIAL NOT NULL,
  "leadId" INTEGER NOT NULL,
  "tenantId" INTEGER,
  "saleType" "CommercialSaleType" NOT NULL,
  "planCode" "PlanCode",
  "packageName" VARCHAR(120),
  "currency" VARCHAR(3) NOT NULL,
  "listPrice" DECIMAL(12, 2) NOT NULL,
  "discountAmount" DECIMAL(12, 2) NOT NULL,
  "netSaleAmount" DECIMAL(12, 2) NOT NULL,
  "amountCollected" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "remainingBalance" DECIMAL(12, 2) NOT NULL,
  "paymentStatus" "CommercialPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "operationalStatus" "CommercialOperationalStatus" NOT NULL DEFAULT 'DRAFT',
  "paymentMethodSummary" VARCHAR(280),
  "dueDate" TIMESTAMP(3),
  "soldAt" TIMESTAMP(3) NOT NULL,
  "salespersonName" VARCHAR(120),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommercialRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalePayment" (
  "id" SERIAL NOT NULL,
  "commercialRecordId" INTEGER NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "paymentMethod" "CommercialPaymentMethod" NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "note" VARCHAR(280),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialRecord_leadId_key" ON "CommercialRecord"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialRecord_tenantId_key" ON "CommercialRecord"("tenantId");

-- CreateIndex
CREATE INDEX "CommercialRecord_tenantId_idx" ON "CommercialRecord"("tenantId");

-- CreateIndex
CREATE INDEX "CommercialRecord_paymentStatus_operationalStatus_idx" ON "CommercialRecord"("paymentStatus", "operationalStatus");

-- CreateIndex
CREATE INDEX "SalePayment_commercialRecordId_paidAt_idx" ON "SalePayment"("commercialRecordId", "paidAt");

-- AddForeignKey
ALTER TABLE "CommercialRecord"
ADD CONSTRAINT "CommercialRecord_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialRecord"
ADD CONSTRAINT "CommercialRecord_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment"
ADD CONSTRAINT "SalePayment_commercialRecordId_fkey"
FOREIGN KEY ("commercialRecordId") REFERENCES "CommercialRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
