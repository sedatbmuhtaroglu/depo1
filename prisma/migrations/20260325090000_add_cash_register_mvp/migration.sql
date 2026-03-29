-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashMovementCategory" AS ENUM (
  'SALES_REVENUE',
  'SUPPLIER_PAYMENT',
  'PERSONNEL_EXPENSE',
  'EXPENSE',
  'CASH_ADJUSTMENT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "CashMovement" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "restaurantId" INTEGER NOT NULL,
  "createdByUserId" INTEGER,
  "type" "CashMovementType" NOT NULL,
  "category" "CashMovementCategory" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "note" VARCHAR(500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isVoided" BOOLEAN NOT NULL DEFAULT false,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegisterDay" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "restaurantId" INTEGER NOT NULL,
  "businessDate" DATE NOT NULL,
  "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "countedBalance" DECIMAL(12,2),
  "systemBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "variance" DECIMAL(12,2),
  "closingNote" VARCHAR(1000),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CashRegisterDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashMovement_tenantId_restaurantId_occurredAt_idx"
ON "CashMovement"("tenantId", "restaurantId", "occurredAt");

-- CreateIndex
CREATE INDEX "CashMovement_tenantId_restaurantId_isVoided_occurredAt_idx"
ON "CashMovement"("tenantId", "restaurantId", "isVoided", "occurredAt");

-- CreateIndex
CREATE INDEX "CashMovement_tenantId_createdByUserId_idx"
ON "CashMovement"("tenantId", "createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CashRegisterDay_tenantId_restaurantId_businessDate_key"
ON "CashRegisterDay"("tenantId", "restaurantId", "businessDate");

-- CreateIndex
CREATE INDEX "CashRegisterDay_tenantId_restaurantId_businessDate_idx"
ON "CashRegisterDay"("tenantId", "restaurantId", "businessDate");

-- AddForeignKey
ALTER TABLE "CashMovement"
ADD CONSTRAINT "CashMovement_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement"
ADD CONSTRAINT "CashMovement_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement"
ADD CONSTRAINT "CashMovement_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "TenantStaff"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterDay"
ADD CONSTRAINT "CashRegisterDay_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegisterDay"
ADD CONSTRAINT "CashRegisterDay_restaurantId_fkey"
FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
