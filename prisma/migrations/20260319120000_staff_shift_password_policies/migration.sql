ALTER TABLE "TenantStaff"
ADD COLUMN "mustSetPassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "passwordInitializedAt" TIMESTAMP(3),
ADD COLUMN "workingDays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[],
ADD COLUMN "shiftStart" VARCHAR(5),
ADD COLUMN "shiftEnd" VARCHAR(5),
ADD COLUMN "notes" VARCHAR(280);
