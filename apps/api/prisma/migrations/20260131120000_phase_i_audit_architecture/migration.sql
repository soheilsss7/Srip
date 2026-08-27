-- PHASE I Audit Architecture
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVAL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TOKEN_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_CHANGE';

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_createdAt_idx" ON "AuditLog"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_correlationId_createdAt_idx" ON "AuditLog"("correlationId", "createdAt");
