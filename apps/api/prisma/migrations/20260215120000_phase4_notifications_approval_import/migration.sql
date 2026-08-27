-- Phase 4: Notification preferences/grouping and explicit import approval gate.
ALTER TABLE "Notification"
  ADD COLUMN "groupKey" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "Notification_userId_groupKey_createdAt_idx"
  ON "Notification"("userId", "groupKey", "createdAt");
CREATE INDEX "Notification_expiresAt_idx"
  ON "Notification"("expiresAt");

ALTER TABLE "NotificationPreference"
  ADD COLUMN "criticalOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dailyDigest" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DataImport"
  ADD COLUMN "approvalRequestId" TEXT;

CREATE INDEX "DataImport_approvalRequestId_idx"
  ON "DataImport"("approvalRequestId");
