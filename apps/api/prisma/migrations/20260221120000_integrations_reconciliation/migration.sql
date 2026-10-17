ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'DRIVE';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'TEAMS';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'SHAREPOINT';

CREATE TABLE "IntegrationExternalRecord" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalThreadId" TEXT,
  "externalUpdatedAt" TIMESTAMP(3),
  "etag" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "cancelledAt" TIMESTAMP(3),
  "meetingId" TEXT,
  "interactionId" TEXT,
  "personId" TEXT,
  "organizationId" TEXT,
  "relationshipId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationExternalRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationExternalRecord_connectionId_kind_externalId_key" ON "IntegrationExternalRecord"("connectionId","kind","externalId");
CREATE INDEX "IntegrationExternalRecord_externalThreadId_idx" ON "IntegrationExternalRecord"("externalThreadId");
CREATE INDEX "IntegrationExternalRecord_meetingId_idx" ON "IntegrationExternalRecord"("meetingId");
CREATE INDEX "IntegrationExternalRecord_interactionId_idx" ON "IntegrationExternalRecord"("interactionId");
CREATE INDEX "IntegrationExternalRecord_personId_idx" ON "IntegrationExternalRecord"("personId");
CREATE INDEX "IntegrationExternalRecord_organizationId_idx" ON "IntegrationExternalRecord"("organizationId");
CREATE INDEX "IntegrationExternalRecord_status_idx" ON "IntegrationExternalRecord"("status");

CREATE TABLE "IntegrationSyncRun" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "seen" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "cancelled" INTEGER NOT NULL DEFAULT 0,
  "matchedPeople" INTEGER NOT NULL DEFAULT 0,
  "matchedOrganizations" INTEGER NOT NULL DEFAULT 0,
  "linkedRelationships" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IntegrationSyncRun_connectionId_startedAt_idx" ON "IntegrationSyncRun"("connectionId","startedAt");
