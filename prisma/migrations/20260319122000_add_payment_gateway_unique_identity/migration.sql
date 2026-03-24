CREATE UNIQUE INDEX IF NOT EXISTS "Payment_tenantId_gatewayProvider_gatewayPaymentId_key"
ON "Payment" ("tenantId", "gatewayProvider", "gatewayPaymentId");
