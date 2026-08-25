ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAG_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAG_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAG_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAG_REMOVED';

CREATE TABLE "TagAssignment" (
  "id" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TagAssignment_tagId_entityType_entityId_key"
  ON "TagAssignment"("tagId","entityType","entityId");
CREATE INDEX "TagAssignment_entityType_entityId_idx" ON "TagAssignment"("entityType","entityId");
CREATE INDEX "TagAssignment_organizationId_idx" ON "TagAssignment"("organizationId");
CREATE INDEX "TagAssignment_createdById_idx" ON "TagAssignment"("createdById");

ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TagAssignment"
  ADD CONSTRAINT "TagAssignment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
