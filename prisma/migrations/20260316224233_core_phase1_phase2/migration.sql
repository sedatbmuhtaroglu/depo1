-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'SODEXO', 'MULTINET', 'TICKET', 'METROPOL');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('CUSTOMER_CHANGED_MIND', 'OUT_OF_STOCK', 'WRONG_ITEM', 'OTHER');

-- AlterEnum
ALTER TYPE "BillRequestStatus" ADD VALUE 'CANCELED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "readyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "options" JSONB,
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "closingHour" VARCHAR(5),
ADD COLUMN     "openingHour" VARCHAR(5),
ADD COLUMN     "orderingDisabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "billRequestId" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemCancellation" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "CancellationReason" NOT NULL,
    "customReason" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_tenantId_tableId_idx" ON "Payment"("tenantId", "tableId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_tenantId_orderId_idx" ON "OrderItemCancellation"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItemCancellation_tenantId_createdAt_idx" ON "OrderItemCancellation"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billRequestId_fkey" FOREIGN KEY ("billRequestId") REFERENCES "BillRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemCancellation" ADD CONSTRAINT "OrderItemCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
