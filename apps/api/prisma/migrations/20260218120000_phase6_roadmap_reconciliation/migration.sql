-- Phase 6+ roadmap reconciliation: schema fields required by the source technical checklist.
ALTER TABLE "Organization" ADD COLUMN "ownerId" TEXT;
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interaction" ADD COLUMN "durationMinutes" INTEGER;
ALTER TABLE "Interaction" ADD COLUMN "followUpRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Interaction" ADD COLUMN "followUpAt" TIMESTAMP(3);

ALTER TABLE "Meeting" ADD COLUMN "location" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "decisions" JSONB;
ALTER TABLE "Meeting" ADD COLUMN "preMeetingBrief" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "recordingReference" TEXT;

ALTER TABLE "Action" ADD COLUMN "personId" TEXT;
ALTER TABLE "Action" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Action_personId_idx" ON "Action"("personId");
CREATE INDEX "Action_projectId_idx" ON "Action"("projectId");
ALTER TABLE "Action" ADD CONSTRAINT "Action_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Commitment" ADD COLUMN "source" TEXT;
ALTER TABLE "Commitment" ADD COLUMN "receiver" TEXT;
ALTER TABLE "Commitment" ADD COLUMN "evidence" JSONB;
ALTER TABLE "Commitment" ADD COLUMN "risk" TEXT;
ALTER TABLE "Commitment" ADD COLUMN "personId" TEXT;
ALTER TABLE "Commitment" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Commitment_personId_idx" ON "Commitment"("personId");
CREATE INDEX "Commitment_projectId_idx" ON "Commitment"("projectId");
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD COLUMN "objective" TEXT;

CREATE TABLE "MfaDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MfaDevice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MfaDevice_userId_enabled_idx" ON "MfaDevice"("userId", "enabled");
ALTER TABLE "MfaDevice" ADD CONSTRAINT "MfaDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");
CREATE INDEX "RecoveryCode_userId_usedAt_idx" ON "RecoveryCode"("userId", "usedAt");
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
