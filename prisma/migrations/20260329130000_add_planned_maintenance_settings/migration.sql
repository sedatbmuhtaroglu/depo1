ALTER TABLE "MarketingSiteConfig"
ADD COLUMN "plannedMaintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "plannedMaintenanceStartsAt" TIMESTAMP(3),
ADD COLUMN "plannedMaintenanceEndsAt" TIMESTAMP(3),
ADD COLUMN "plannedMaintenanceMessage" VARCHAR(500);
