-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'INITIATED', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentConversationId" VARCHAR(191),
ADD COLUMN     "paymentProvider" "PaymentGatewayProvider",
ADD COLUMN     "paymentReference" VARCHAR(191),
ADD COLUMN     "paymentStatus" "OrderPaymentStatus";
