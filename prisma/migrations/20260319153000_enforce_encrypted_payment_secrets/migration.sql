-- New/updated records must keep provider secret encrypted at rest.
-- Existing legacy plaintext rows are tolerated temporarily (NOT VALID)
-- and should be remediated with scripts/backfill-encrypted-secrets.ts.
ALTER TABLE "TenantPaymentConfig"
ADD CONSTRAINT "TenantPaymentConfig_secretKey_encrypted_chk"
CHECK (
  "secretKey" IS NULL
  OR BTRIM("secretKey") = ''
  OR "secretKey" LIKE 'enc:v1:%'
) NOT VALID;
