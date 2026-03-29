-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isRiskFlagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskLevel" VARCHAR(16),
ADD COLUMN     "riskReasons" JSONB,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tableId" INTEGER,
    "tableSessionId" INTEGER,
    "actionType" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" VARCHAR(16),
    "reasons" JSONB,
    "ipHash" VARCHAR(128),
    "fingerprintHash" VARCHAR(128),
    "userAgentHash" VARCHAR(128),
    "clientTimezone" VARCHAR(64),
    "clientLat" DECIMAL(10,7),
    "clientLng" DECIMAL(10,7),
    "clientAccuracyM" DECIMAL(10,2),
    "ipCountry" VARCHAR(8),
    "ipCity" VARCHAR(64),
    "ipTimezone" VARCHAR(64),
    "ipRiskLevel" VARCHAR(16),
    "ipRiskProvider" VARCHAR(32),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_createdAt_idx" ON "SecurityEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_tenantId_actionType_createdAt_idx" ON "SecurityEvent"("tenantId", "actionType", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_fingerprintHash_createdAt_idx" ON "SecurityEvent"("fingerprintHash", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_ipHash_createdAt_idx" ON "SecurityEvent"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_isRiskFlagged_createdAt_idx" ON "Order"("isRiskFlagged", "createdAt");

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
