-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "locationEnforcementEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationLatitude" DECIMAL(10,7),
ADD COLUMN     "locationLongitude" DECIMAL(10,7),
ADD COLUMN     "orderRadiusMeters" INTEGER NOT NULL DEFAULT 100;
