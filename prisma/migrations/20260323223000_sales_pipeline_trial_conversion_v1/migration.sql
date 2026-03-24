-- CreateEnum
CREATE TYPE "SalesLeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'TRIAL_STARTED',
  'WON',
  'LOST'
);

-- CreateEnum
CREATE TYPE "SalesLeadSource" AS ENUM (
  'INSTAGRAM',
  'WEBSITE',
  'REFERRAL',
  'MANUAL',
  'DEMO',
  'OTHER'
);

-- CreateTable
CREATE TABLE "SalesLead" (
  "id" SERIAL NOT NULL,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "phone" VARCHAR(32),
  "email" VARCHAR(180),
  "city" VARCHAR(120),
  "notes" TEXT,
  "source" "SalesLeadSource" NOT NULL DEFAULT 'MANUAL',
  "status" "SalesLeadStatus" NOT NULL DEFAULT 'NEW',
  "assignedTo" VARCHAR(120),
  "lostReason" VARCHAR(280),
  "tenantId" INTEGER,
  "trialStartedAt" TIMESTAMP(3),
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesLeadEvent" (
  "id" SERIAL NOT NULL,
  "leadId" INTEGER NOT NULL,
  "actorUsername" VARCHAR(120) NOT NULL,
  "actionType" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesLeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SalesLead_source_createdAt_idx" ON "SalesLead"("source", "createdAt");

-- CreateIndex
CREATE INDEX "SalesLead_tenantId_idx" ON "SalesLead"("tenantId");

-- CreateIndex
CREATE INDEX "SalesLead_email_idx" ON "SalesLead"("email");

-- CreateIndex
CREATE INDEX "SalesLeadEvent_leadId_createdAt_idx" ON "SalesLeadEvent"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "SalesLead"
ADD CONSTRAINT "SalesLead_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesLeadEvent"
ADD CONSTRAINT "SalesLeadEvent_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
