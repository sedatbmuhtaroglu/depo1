-- AlterEnum
DO $$
BEGIN
  IF to_regtype('"FeatureCode"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'INVOICING'
      AND enumtypid = to_regtype('"FeatureCode"')
  ) THEN
    ALTER TYPE "FeatureCode" ADD VALUE 'INVOICING';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('"FeatureCode"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'ADVANCED_REPORTS'
      AND enumtypid = to_regtype('"FeatureCode"')
  ) THEN
    ALTER TYPE "FeatureCode" ADD VALUE 'ADVANCED_REPORTS';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('"FeatureCode"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'KITCHEN_DISPLAY'
      AND enumtypid = to_regtype('"FeatureCode"')
  ) THEN
    ALTER TYPE "FeatureCode" ADD VALUE 'KITCHEN_DISPLAY';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regtype('"FeatureCode"') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'ANALYTICS'
      AND enumtypid = to_regtype('"FeatureCode"')
  ) THEN
    ALTER TYPE "FeatureCode" ADD VALUE 'ANALYTICS';
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LimitResource') THEN
    CREATE TYPE "LimitResource" AS ENUM (
      'USERS',
      'TABLES',
      'MENUS',
      'PRODUCTS',
      'BRANCHES',
      'DEVICES'
    );
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantLimitOverride" (
  "id" SERIAL NOT NULL,
  "tenantId" INTEGER NOT NULL,
  "resource" "LimitResource" NOT NULL,
  "limit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantLimitOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TenantLimitOverride_tenantId_resource_key"
ON "TenantLimitOverride"("tenantId", "resource");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantLimitOverride_tenantId_idx"
ON "TenantLimitOverride"("tenantId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantLimitOverride_tenantId_fkey'
  ) THEN
    ALTER TABLE "TenantLimitOverride"
    ADD CONSTRAINT "TenantLimitOverride_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
