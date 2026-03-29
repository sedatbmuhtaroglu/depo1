-- RenameIndex (safe for fresh databases where the old index name does not exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_expir_'
  ) THEN
    ALTER INDEX "StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_expir_"
      RENAME TO "StaffSetPasswordToken_tenantStaffId_consumedAt_revokedAt_ex_idx";
  END IF;
END $$;
