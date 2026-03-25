-- CreateTable
CREATE TABLE "TenantAllergen" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAllergen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantAllergen_tenantId_isActive_sortOrder_idx" ON "TenantAllergen"("tenantId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAllergen_tenantId_name_key" ON "TenantAllergen"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "TenantAllergen" ADD CONSTRAINT "TenantAllergen_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
