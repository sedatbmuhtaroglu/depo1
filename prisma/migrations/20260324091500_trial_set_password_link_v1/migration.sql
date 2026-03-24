-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TenantStaff"
ADD COLUMN "email" VARCHAR(180),
ADD COLUMN "phone" VARCHAR(32);

-- AlterTable
ALTER TABLE "SalesLead"
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "trialAdminUsername" VARCHAR(120);

-- CreateTable
CREATE TABLE "StaffSetPasswordToken" (
  "id" SERIAL NOT NULL,
  "tenantStaffId" INTEGER NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdBy" VARCHAR(120),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StaffSetPasswordToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSetPasswordToken_tokenHash_key" ON "StaffSetPasswordToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSetPasswordToken_tenantStaffId_createdAt_idx" ON "StaffSetPasswordToken"("tenantStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_expir_idx" ON "StaffSetPasswordToken"("tenantStaffId", "consumedAt", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "StaffSetPasswordToken"
ADD CONSTRAINT "StaffSetPasswordToken_tenantStaffId_fkey"
FOREIGN KEY ("tenantStaffId") REFERENCES "TenantStaff"("id")
ON DELETE CASCADE ON UPDATE CASCADE;