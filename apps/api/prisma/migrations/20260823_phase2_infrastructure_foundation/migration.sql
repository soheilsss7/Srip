-- SRIP Phase 2 Infrastructure Foundation migration. Generated from apps/api/prisma/schema.prisma.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "OrganizationType" AS ENUM ('HOLDING', 'SUBSIDIARY', 'CUSTOMER', 'PARTNER', 'BANK', 'GOVERNMENT', 'INVESTOR', 'SUPPLIER', 'OTHER');
CREATE TYPE "RelationshipStatus" AS ENUM ('PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED');
CREATE TYPE "InteractionType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'NOTE', 'MESSAGE', 'OTHER');
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "CommitmentStatus" AS ENUM ('OPEN', 'FULFILLED', 'OVERDUE', 'CANCELLED');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RequirementStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SATISFIED', 'BLOCKED', 'CANCELLED');
CREATE TYPE "OpportunityStatus" AS ENUM ('IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ALERT');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PERMISSION_CHANGE');
CREATE TYPE "DataClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PRIVATE');
CREATE TYPE "TokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "User" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "type" "OrganizationType" DEFAULT 'OTHER'::"OrganizationType" NOT NULL,
  "status" "OrganizationStatus" DEFAULT 'ACTIVE'::"OrganizationStatus" NOT NULL,
  "industry" TEXT,
  "country" TEXT,
  "city" TEXT,
  "address" TEXT,
  "website" TEXT,
  "registrationId" TEXT,
  "parentOrganizationId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT DEFAULT 'STANDARD_USER' NOT NULL,
  "department" TEXT,
  "dataScope" "DataClassification" DEFAULT 'INTERNAL'::"DataClassification" NOT NULL,
  "isPrimary" BOOLEAN DEFAULT false NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "title" TEXT,
  "influenceScore" INTEGER DEFAULT 0 NOT NULL,
  "decisionPower" INTEGER DEFAULT 0 NOT NULL,
  "accessibilityScore" INTEGER DEFAULT 0 NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Relationship" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "sourceOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "status" "RelationshipStatus" DEFAULT 'PROSPECTIVE'::"RelationshipStatus" NOT NULL,
  "healthScore" INTEGER DEFAULT 0 NOT NULL,
  "strategicScore" INTEGER DEFAULT 0 NOT NULL,
  "riskScore" INTEGER DEFAULT 0 NOT NULL,
  "trustScore" INTEGER DEFAULT 0 NOT NULL,
  "accessScore" INTEGER DEFAULT 0 NOT NULL,
  "influenceScore" INTEGER DEFAULT 0 NOT NULL,
  "opportunityScore" INTEGER DEFAULT 0 NOT NULL,
  "resilienceScore" INTEGER DEFAULT 0 NOT NULL,
  "sensitivity" "DataClassification" DEFAULT 'INTERNAL'::"DataClassification" NOT NULL,
  "engagementScore" INTEGER DEFAULT 0 NOT NULL,
  "ownerId" TEXT,
  "backupOwnerId" TEXT,
  "reviewCadenceDays" INTEGER DEFAULT 90 NOT NULL,
  "lastInteractionAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelationshipScoreSnapshot" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "healthScore" INTEGER NOT NULL,
  "strategicScore" INTEGER NOT NULL,
  "riskScore" INTEGER NOT NULL,
  "trustScore" INTEGER NOT NULL,
  "accessScore" INTEGER NOT NULL,
  "influenceScore" INTEGER NOT NULL,
  "opportunityScore" INTEGER NOT NULL,
  "resilienceScore" INTEGER NOT NULL,
  "engagementScore" INTEGER NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "RelationshipScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Interaction" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "type" "InteractionType" NOT NULL,
  "subject" TEXT NOT NULL,
  "summary" TEXT,
  "outcome" TEXT,
  "importance" "Priority" DEFAULT 'MEDIUM'::"Priority" NOT NULL,
  "sentiment" INTEGER,
  "occurredAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "personId" TEXT,
  "relationshipId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meeting" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "title" TEXT NOT NULL,
  "objective" TEXT,
  "agenda" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "notes" TEXT,
  "outcome" TEXT,
  "transcript" TEXT,
  "meetingUrl" TEXT,
  "ownerId" TEXT NOT NULL,
  "organizationId" TEXT,
  "relationshipId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingParticipant" (
  "meetingId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("meetingId", "personId")
);

CREATE TABLE "Action" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ActionStatus" DEFAULT 'OPEN'::"ActionStatus" NOT NULL,
  "priority" "Priority" DEFAULT 'MEDIUM'::"Priority" NOT NULL,
  "dueAt" TIMESTAMP(3),
  "ownerId" TEXT NOT NULL,
  "relationshipId" TEXT,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Commitment" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "description" TEXT NOT NULL,
  "status" "CommitmentStatus" DEFAULT 'OPEN'::"CommitmentStatus" NOT NULL,
  "dueAt" TIMESTAMP(3),
  "ownerId" TEXT NOT NULL,
  "relationshipId" TEXT,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" DEFAULT 'PLANNED'::"ProjectStatus" NOT NULL,
  "priority" "Priority" DEFAULT 'MEDIUM'::"Priority" NOT NULL,
  "startAt" TIMESTAMP(3),
  "targetAt" TIMESTAMP(3),
  "organizationId" TEXT,
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectRelationship" (
  "projectId" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "relevance" INTEGER DEFAULT 0 NOT NULL,
  "required" BOOLEAN DEFAULT false NOT NULL,
  "status" TEXT DEFAULT 'UNENGAGED' NOT NULL,
  CONSTRAINT "ProjectRelationship_pkey" PRIMARY KEY ("projectId", "relationshipId")
);

CREATE TABLE "Requirement" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "projectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "status" "RequirementStatus" DEFAULT 'OPEN'::"RequirementStatus" NOT NULL,
  "priority" "Priority" DEFAULT 'MEDIUM'::"Priority" NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "OpportunityStatus" DEFAULT 'IDENTIFIED'::"OpportunityStatus" NOT NULL,
  "value" DECIMAL(18,2),
  "probability" INTEGER DEFAULT 0 NOT NULL,
  "organizationId" TEXT,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Note" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "organizationId" TEXT,
  "personId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Document" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "organizationId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" DEFAULT 'INFO'::"NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "data" JSONB,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT,
  "relationshipId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "confidence" INTEGER DEFAULT 0 NOT NULL,
  "status" TEXT DEFAULT 'PROPOSED' NOT NULL,
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT,
  "action" "AuditAction" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "requestId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "role" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("role", "permissionId")
);

CREATE TABLE "Session" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginHistory" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workflow" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "definition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowExecution" (
  "id" TEXT DEFAULT gen_random_uuid() NOT NULL,
  "workflowId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "context" JSONB,
  "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_organizationId_key" UNIQUE ("userId", "organizationId");
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceOrganizationId_targetOrganizationId_relationshipType_key" UNIQUE ("sourceOrganizationId", "targetOrganizationId", "relationshipType");
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_key" UNIQUE ("name");
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_key_key" UNIQUE ("key");
ALTER TABLE "Session" ADD CONSTRAINT "Session_tokenHash_key" UNIQUE ("tokenHash");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_tokenHash_key" UNIQUE ("tokenHash");
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_tokenHash_key" UNIQUE ("tokenHash");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentOrganizationId_fkey" FOREIGN KEY ("parentOrganizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "RelationshipScoreSnapshot" ADD CONSTRAINT "RelationshipScoreSnapshot_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "ProjectRelationship" ADD CONSTRAINT "ProjectRelationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "ProjectRelationship" ADD CONSTRAINT "ProjectRelationship_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE Cascade ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE Cascade ON UPDATE CASCADE;
CREATE INDEX "Organization_name_idx" ON "Organization" ("name");
CREATE INDEX "Organization_parentOrganizationId_idx" ON "Organization" ("parentOrganizationId");
CREATE INDEX "Organization_registrationId_idx" ON "Organization" ("registrationId");
CREATE INDEX "Membership_organizationId_role_idx" ON "Membership" ("organizationId", "role");
CREATE INDEX "Person_organizationId_idx" ON "Person" ("organizationId");
CREATE INDEX "Person_email_idx" ON "Person" ("email");
CREATE INDEX "Person_lastName_firstName_idx" ON "Person" ("lastName", "firstName");
CREATE INDEX "Relationship_status_idx" ON "Relationship" ("status");
CREATE INDEX "Relationship_healthScore_idx" ON "Relationship" ("healthScore");
CREATE INDEX "Relationship_ownerId_idx" ON "Relationship" ("ownerId");
CREATE INDEX "RelationshipScoreSnapshot_relationshipId_createdAt_idx" ON "RelationshipScoreSnapshot" ("relationshipId", "createdAt");
CREATE INDEX "Interaction_occurredAt_idx" ON "Interaction" ("occurredAt");
CREATE INDEX "Interaction_relationshipId_idx" ON "Interaction" ("relationshipId");
CREATE INDEX "Interaction_organizationId_idx" ON "Interaction" ("organizationId");
CREATE INDEX "Meeting_startAt_idx" ON "Meeting" ("startAt");
CREATE INDEX "Meeting_relationshipId_idx" ON "Meeting" ("relationshipId");
CREATE INDEX "Action_status_dueAt_idx" ON "Action" ("status", "dueAt");
CREATE INDEX "Commitment_status_dueAt_idx" ON "Commitment" ("status", "dueAt");
CREATE INDEX "Project_status_idx" ON "Project" ("status");
CREATE INDEX "Project_organizationId_idx" ON "Project" ("organizationId");
CREATE INDEX "Requirement_projectId_status_idx" ON "Requirement" ("projectId", "status");
CREATE INDEX "Opportunity_status_idx" ON "Opportunity" ("status");
CREATE INDEX "Document_organizationId_idx" ON "Document" ("organizationId");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification" ("userId", "readAt", "createdAt");
CREATE INDEX "Recommendation_status_createdAt_idx" ON "Recommendation" ("status", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog" ("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session" ("userId", "revokedAt");
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory" ("userId", "createdAt");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken" ("userId", "expiresAt");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken" ("userId", "expiresAt");
CREATE INDEX "WorkflowExecution_entityType_entityId_idx" ON "WorkflowExecution" ("entityType", "entityId");

-- Prisma migration bookkeeping is handled by Prisma Migrate when this migration is applied.