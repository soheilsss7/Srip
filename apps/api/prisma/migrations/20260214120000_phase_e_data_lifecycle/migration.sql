-- Phase E: centralized data lifecycle, restore and governed permanent deletion
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SOFT_DELETE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RESTORE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERMANENT_DELETE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELETE_APPROVAL_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELETE_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELETE_REJECTED';

ALTER TYPE "DataLifecycleState" ADD VALUE IF NOT EXISTS 'RESTORED';
ALTER TYPE "DataLifecycleState" ADD VALUE IF NOT EXISTS 'PURGED';

CREATE TYPE "DataDeletionApprovalStatus" AS ENUM ('PENDING','APPROVED','REJECTED','EXPIRED');

ALTER TABLE "DataLifecycleRecord" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
ALTER TABLE "DataLifecycleRecord" ADD COLUMN IF NOT EXISTS "approvalId" TEXT;
ALTER TABLE "DataLifecycleRecord" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
CREATE INDEX IF NOT EXISTS "DataLifecycleRecord_approvalId_idx" ON "DataLifecycleRecord"("approvalId");

CREATE TABLE "DataDeletionApproval" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "status" "DataDeletionApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "DataDeletionApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataDeletionApproval_entity_status_idx" ON "DataDeletionApproval"("entityType","entityId","status");
CREATE INDEX "DataDeletionApproval_org_status_idx" ON "DataDeletionApproval"("organizationId","status");
CREATE INDEX "DataDeletionApproval_requested_status_idx" ON "DataDeletionApproval"("requestedById","status");

ALTER TABLE "DataLifecycleRecord" ADD CONSTRAINT "DataLifecycleRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataDeletionApproval" ADD CONSTRAINT "DataDeletionApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataDeletionApproval" ADD CONSTRAINT "DataDeletionApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "IntegrationConnection" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
