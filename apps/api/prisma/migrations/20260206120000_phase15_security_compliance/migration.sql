CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO','WARNING','HIGH','CRITICAL');
CREATE TYPE "SecurityEventType" AS ENUM ('LOGIN_SUCCESS','LOGIN_FAILURE','ACCOUNT_LOCKED','PERMISSION_DENIED','RATE_LIMITED','SUSPICIOUS_ACCESS','EXPORT_CREATED','MFA_EVENT');
CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL, "userId" TEXT, "organizationId" TEXT, "type" "SecurityEventType" NOT NULL,
  "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO', "requestId" TEXT, "ipAddress" TEXT,
  "userAgent" TEXT, "entityType" TEXT, "entityId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataExportLog" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "organizationId" TEXT, "exportType" TEXT NOT NULL,
  "entityType" TEXT, "recordCount" INTEGER NOT NULL DEFAULT 0, "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
  "requestId" TEXT, "ipAddress" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataExportLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type","createdAt");
CREATE INDEX "SecurityEvent_severity_createdAt_idx" ON "SecurityEvent"("severity","createdAt");
CREATE INDEX "SecurityEvent_organizationId_createdAt_idx" ON "SecurityEvent"("organizationId","createdAt");
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId","createdAt");
CREATE INDEX "DataExportLog_userId_createdAt_idx" ON "DataExportLog"("userId","createdAt");
CREATE INDEX "DataExportLog_organizationId_createdAt_idx" ON "DataExportLog"("organizationId","createdAt");
CREATE INDEX "DataExportLog_exportType_createdAt_idx" ON "DataExportLog"("exportType","createdAt");
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataExportLog" ADD CONSTRAINT "DataExportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataExportLog" ADD CONSTRAINT "DataExportLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
