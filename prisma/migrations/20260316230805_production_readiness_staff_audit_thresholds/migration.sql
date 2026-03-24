-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'WAITER', 'KITCHEN');

-- AlterTable
ALTER TABLE "BillRequest" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedByStaffId" INTEGER;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredByStaffId" INTEGER;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "kitchenWarningOrangeMin" INTEGER,
ADD COLUMN     "kitchenWarningRedMin" INTEGER,
ADD COLUMN     "kitchenWarningYellowMin" INTEGER;

-- AlterTable
ALTER TABLE "WaiterCall" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedByStaffId" INTEGER;

-- CreateTable
CREATE TABLE "TenantStaff" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "actorType" VARCHAR(20) NOT NULL,
    "actorId" VARCHAR(128),
    "role" VARCHAR(20),
    "actionType" VARCHAR(64) NOT NULL,
    "entityType" VARCHAR(32) NOT NULL,
    "entityId" VARCHAR(64),
    "description" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantStaff_tenantId_idx" ON "TenantStaff"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantStaff_tenantId_username_key" ON "TenantStaff"("tenantId", "username");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_actionType_idx" ON "AuditLog"("tenantId", "actionType");

-- CreateIndex
CREATE INDEX "WaiterCall_tenantId_createdAt_idx" ON "WaiterCall"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantStaff" ADD CONSTRAINT "TenantStaff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveredByStaffId_fkey" FOREIGN KEY ("deliveredByStaffId") REFERENCES "TenantStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_acknowledgedByStaffId_fkey" FOREIGN KEY ("acknowledgedByStaffId") REFERENCES "TenantStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_acknowledgedByStaffId_fkey" FOREIGN KEY ("acknowledgedByStaffId") REFERENCES "TenantStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
