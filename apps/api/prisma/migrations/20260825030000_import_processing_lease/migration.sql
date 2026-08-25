ALTER TABLE "DataImport"
  ADD COLUMN "processingLeaseId" TEXT,
  ADD COLUMN "processingHeartbeatAt" TIMESTAMP(3);

CREATE INDEX "DataImport_processingLeaseId_processingHeartbeatAt_idx"
  ON "DataImport"("processingLeaseId", "processingHeartbeatAt");
