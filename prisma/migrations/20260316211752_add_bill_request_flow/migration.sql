-- CreateEnum
CREATE TYPE "BillRequestStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'SETTLED');

-- CreateTable
CREATE TABLE "BillRequest" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "tableSessionId" INTEGER,
    "status" "BillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "BillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillRequest_tenantId_tableId_idx" ON "BillRequest"("tenantId", "tableId");

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
