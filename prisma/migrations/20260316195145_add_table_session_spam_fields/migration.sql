-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "blockedUntil" TIMESTAMP(3),
ADD COLUMN     "lastOrderAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lastWaiterCallAt" TIMESTAMP(3),
ADD COLUMN     "spamStrike" INTEGER NOT NULL DEFAULT 0;
