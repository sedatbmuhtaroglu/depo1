-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('IYZICO');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "gatewayPaymentId" TEXT,
ADD COLUMN     "gatewayProvider" "PaymentGatewayProvider";

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "billRequestId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "gatewayToken" TEXT NOT NULL,
    "gatewayProvider" "PaymentGatewayProvider" NOT NULL,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_gatewayToken_key" ON "PaymentIntent"("gatewayToken");

-- CreateIndex
CREATE INDEX "PaymentIntent_tenantId_status_idx" ON "PaymentIntent"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentIntent_gatewayToken_idx" ON "PaymentIntent"("gatewayToken");

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_billRequestId_fkey" FOREIGN KEY ("billRequestId") REFERENCES "BillRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
