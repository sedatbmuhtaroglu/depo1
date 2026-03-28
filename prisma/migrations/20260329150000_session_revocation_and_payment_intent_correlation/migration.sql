-- Session revocation primitives for admin/staff sessions
ALTER TABLE "AdminUser"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sessionRevokedAfter" TIMESTAMP(3);

ALTER TABLE "TenantStaff"
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sessionRevokedAfter" TIMESTAMP(3);

-- Stronger iyzico callback correlation fields
ALTER TABLE "PaymentIntent"
ADD COLUMN "gatewayConversationId" VARCHAR(191),
ADD COLUMN "gatewayPaymentId" VARCHAR(191),
ADD COLUMN "callbackVerifiedAt" TIMESTAMP(3);
