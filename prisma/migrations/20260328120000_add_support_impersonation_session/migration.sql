-- CreateEnum
CREATE TYPE "SupportSessionAssumedRole" AS ENUM ('MANAGER');

-- CreateTable
CREATE TABLE "SupportImpersonationSession" (
    "id" SERIAL NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "hqAdminUserId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "restaurantId" INTEGER,
    "assumedRole" "SupportSessionAssumedRole" NOT NULL DEFAULT 'MANAGER',
    "reason" VARCHAR(200) NOT NULL,
    "note" VARCHAR(500),
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportImpersonationSession_tokenHash_key" ON "SupportImpersonationSession"("tokenHash");

CREATE INDEX "SupportImpersonationSession_tenantId_expiresAt_idx" ON "SupportImpersonationSession"("tenantId", "expiresAt");

CREATE INDEX "SupportImpersonationSession_hqAdminUserId_createdAt_idx" ON "SupportImpersonationSession"("hqAdminUserId", "createdAt");

ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_hqAdminUserId_fkey" FOREIGN KEY ("hqAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportImpersonationSession" ADD CONSTRAINT "SupportImpersonationSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
