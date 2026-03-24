-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "requestedPaymentMethod" "PaymentMethod";

-- AlterTable
ALTER TABLE "TenantStaff" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
