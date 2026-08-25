
-- Phase 23: Core Domain reconciliation.
-- Adds explicit domain entities/attributes required by the canonical technical specification.

DO $$ BEGIN
  CREATE TYPE "ReferralStatus" AS ENUM ('PENDING','ACCEPTED','DECLINED','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ConnectionPathType" AS ENUM ('DIRECT','ONE_HOP','TWO_HOP','MULTI_HOP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED','IN_PROGRESS','COMPLETED','BLOCKED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "completionAt" TIMESTAMP(3);
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "completionAt" TIMESTAMP(3);
ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL,
  "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "message" TEXT,
  "sourceOrganizationId" TEXT,
  "targetOrganizationId" TEXT,
  "sourcePersonId" TEXT,
  "targetPersonId" TEXT,
  "relationshipId" TEXT,
  "createdById" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Referral_status_createdAt_idx" ON "Referral"("status","createdAt");
CREATE INDEX IF NOT EXISTS "Referral_sourceOrganizationId_idx" ON "Referral"("sourceOrganizationId");
CREATE INDEX IF NOT EXISTS "Referral_targetOrganizationId_idx" ON "Referral"("targetOrganizationId");
CREATE INDEX IF NOT EXISTS "Referral_createdById_idx" ON "Referral"("createdById");

CREATE TABLE IF NOT EXISTS "ActionDependency" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "dependsOnActionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionDependency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionDependency_actionId_dependsOnActionId_key" UNIQUE ("actionId","dependsOnActionId")
);
CREATE INDEX IF NOT EXISTS "ActionDependency_dependsOnActionId_idx" ON "ActionDependency"("dependsOnActionId");

CREATE TABLE IF NOT EXISTS "ProjectRisk" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "ownerId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "probability" INTEGER NOT NULL DEFAULT 0,
  "impact" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "mitigation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectRisk_projectId_status_idx" ON "ProjectRisk"("projectId","status");

CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "ownerId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectMilestone_projectId_status_idx" ON "ProjectMilestone"("projectId","status");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_dueAt_idx" ON "ProjectMilestone"("dueAt");

CREATE TABLE IF NOT EXISTS "ConnectionPath" (
  "id" TEXT NOT NULL,
  "sourceOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "type" "ConnectionPathType" NOT NULL,
  "hops" INTEGER NOT NULL,
  "strength" INTEGER NOT NULL DEFAULT 0,
  "successProbability" INTEGER NOT NULL DEFAULT 0,
  "bestConnectorOrganizationId" TEXT,
  "bestConnectorPersonId" TEXT,
  "nodes" JSONB NOT NULL,
  "edges" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConnectionPath_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConnectionPath_sourceOrganizationId_targetOrganizationId_idx" ON "ConnectionPath"("sourceOrganizationId","targetOrganizationId");
CREATE INDEX IF NOT EXISTS "ConnectionPath_type_strength_idx" ON "ConnectionPath"("type","strength");

-- Foreign keys are guarded so re-running a partially applied migration is safe.
DO $$ BEGIN
  ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_sourcePersonId_fkey" FOREIGN KEY ("sourcePersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "Referral" ADD CONSTRAINT "Referral_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ActionDependency" ADD CONSTRAINT "ActionDependency_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ActionDependency" ADD CONSTRAINT "ActionDependency_dependsOnActionId_fkey" FOREIGN KEY ("dependsOnActionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ConnectionPath" ADD CONSTRAINT "ConnectionPath_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ConnectionPath" ADD CONSTRAINT "ConnectionPath_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ConnectionPath" ADD CONSTRAINT "ConnectionPath_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
