-- Additive-only: field-level PII encryption columns (AES-GCM + blind index).

ALTER TABLE "SalesLead" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "SalesLead" ADD COLUMN "emailHash" VARCHAR(64);
ALTER TABLE "SalesLead" ADD COLUMN "emailMasked" VARCHAR(64);
ALTER TABLE "SalesLead" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "SalesLead" ADD COLUMN "phoneHash" VARCHAR(64);
ALTER TABLE "SalesLead" ADD COLUMN "phoneLast4" VARCHAR(4);
ALTER TABLE "SalesLead" ADD COLUMN "contactNameEncrypted" TEXT;
ALTER TABLE "SalesLead" ADD COLUMN "contactNameHash" VARCHAR(64);
ALTER TABLE "SalesLead" ADD COLUMN "contactNameMasked" VARCHAR(64);

CREATE INDEX "SalesLead_emailHash_idx" ON "SalesLead"("emailHash");
CREATE INDEX "SalesLead_phoneHash_idx" ON "SalesLead"("phoneHash");

ALTER TABLE "MarketingFormSubmission" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "emailHash" VARCHAR(64);
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "emailMasked" VARCHAR(64);
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "phoneHash" VARCHAR(64);
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "phoneLast4" VARCHAR(4);
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "contactNameEncrypted" TEXT;
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "contactNameHash" VARCHAR(64);
ALTER TABLE "MarketingFormSubmission" ADD COLUMN "contactNameMasked" VARCHAR(64);

CREATE INDEX "MarketingFormSubmission_emailHash_idx" ON "MarketingFormSubmission"("emailHash");
CREATE INDEX "MarketingFormSubmission_phoneHash_idx" ON "MarketingFormSubmission"("phoneHash");

ALTER TABLE "TenantStaff" ADD COLUMN "emailEncrypted" TEXT;
ALTER TABLE "TenantStaff" ADD COLUMN "emailHash" VARCHAR(64);
ALTER TABLE "TenantStaff" ADD COLUMN "emailMasked" VARCHAR(64);
ALTER TABLE "TenantStaff" ADD COLUMN "phoneEncrypted" TEXT;
ALTER TABLE "TenantStaff" ADD COLUMN "phoneHash" VARCHAR(64);
ALTER TABLE "TenantStaff" ADD COLUMN "phoneLast4" VARCHAR(4);

CREATE INDEX "TenantStaff_emailHash_idx" ON "TenantStaff"("emailHash");
CREATE INDEX "TenantStaff_phoneHash_idx" ON "TenantStaff"("phoneHash");
