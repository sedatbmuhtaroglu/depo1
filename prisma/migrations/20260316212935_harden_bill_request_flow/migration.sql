-- CreateIndex
CREATE INDEX "BillRequest_tenantId_status_createdAt_idx" ON "BillRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillRequest_tenantId_tableId_status_idx" ON "BillRequest"("tenantId", "tableId", "status");

-- CreateIndex
CREATE INDEX "BillRequest_tenantId_tableSessionId_status_idx" ON "BillRequest"("tenantId", "tableSessionId", "status");
