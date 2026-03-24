-- CreateTable
CREATE TABLE "TenantPaymentConfig" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" "PaymentGatewayProvider" NOT NULL,
    "apiKey" TEXT,
    "secretKey" TEXT,
    "isSandbox" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantPaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantPaymentConfig_tenantId_idx" ON "TenantPaymentConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantPaymentConfig_tenantId_provider_key" ON "TenantPaymentConfig"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "TenantPaymentConfig" ADD CONSTRAINT "TenantPaymentConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
