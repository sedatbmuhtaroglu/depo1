-- CreateEnum
CREATE TYPE "OrderRefundStatus" AS ENUM ('NONE', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED');

-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "refundStatus" "OrderRefundStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "refundedAt" TIMESTAMP(3),
ADD COLUMN "refundReference" VARCHAR(191),
ADD COLUMN "refundFailureReason" VARCHAR(512);
