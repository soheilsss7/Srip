-- Phase 3: Database / ERD Foundation
-- Adds soft-delete governance, missing FK integrity, tenant-scoping anchors and audit reason.

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Organization" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Person" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Relationship" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Interaction" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Action" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Commitment" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Requirement" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Note" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Notification" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "Workflow" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT, ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "reason" TEXT, ADD COLUMN "organizationId" TEXT;

-- Missing ownership/creator foreign keys that were previously only scalar IDs.
ALTER TABLE "Relationship"
  ADD CONSTRAINT "Relationship_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Relationship_backupOwnerId_fkey" FOREIGN KEY ("backupOwnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note"
  ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Soft-delete actor references.
ALTER TABLE "User"
  ADD CONSTRAINT "User_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Person"
  ADD CONSTRAINT "Person_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Relationship"
  ADD CONSTRAINT "Relationship_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Action"
  ADD CONSTRAINT "Action_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Commitment"
  ADD CONSTRAINT "Commitment_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Requirement"
  ADD CONSTRAINT "Requirement_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Note"
  ADD CONSTRAINT "Note_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Recommendation"
  ADD CONSTRAINT "Recommendation_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workflow"
  ADD CONSTRAINT "Workflow_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Organization tenant-scope anchor for audit/workflow data.
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Workflow"
  ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes supporting active-row filtering and tenant-scoped access.
CREATE INDEX "User_deletedAt_idx" ON "User" ("deletedAt");
CREATE INDEX "Organization_deletedAt_idx" ON "Organization" ("deletedAt");
CREATE INDEX "Person_deletedAt_idx" ON "Person" ("deletedAt");
CREATE INDEX "Relationship_deletedAt_idx" ON "Relationship" ("deletedAt");
CREATE INDEX "Interaction_deletedAt_idx" ON "Interaction" ("deletedAt");
CREATE INDEX "Meeting_deletedAt_idx" ON "Meeting" ("deletedAt");
CREATE INDEX "Action_deletedAt_idx" ON "Action" ("deletedAt");
CREATE INDEX "Commitment_deletedAt_idx" ON "Commitment" ("deletedAt");
CREATE INDEX "Project_deletedAt_idx" ON "Project" ("deletedAt");
CREATE INDEX "Requirement_deletedAt_idx" ON "Requirement" ("deletedAt");
CREATE INDEX "Opportunity_deletedAt_idx" ON "Opportunity" ("deletedAt");
CREATE INDEX "Note_deletedAt_idx" ON "Note" ("deletedAt");
CREATE INDEX "Document_deletedAt_idx" ON "Document" ("deletedAt");
CREATE INDEX "Notification_deletedAt_idx" ON "Notification" ("deletedAt");
CREATE INDEX "Recommendation_deletedAt_idx" ON "Recommendation" ("deletedAt");
CREATE INDEX "Workflow_organizationId_isActive_idx" ON "Workflow" ("organizationId", "isActive");
CREATE INDEX "Workflow_deletedAt_idx" ON "Workflow" ("deletedAt");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog" ("organizationId", "createdAt");
