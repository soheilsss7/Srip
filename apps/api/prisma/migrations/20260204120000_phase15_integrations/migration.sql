CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE','MICROSOFT');
CREATE TYPE "IntegrationKind" AS ENUM ('CALENDAR','EMAIL');
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING','CONNECTED','ERROR','DISCONNECTED');
CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "provider" "IntegrationProvider" NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
  "accountLabel" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "scopes" TEXT,
  "expiresAt" TIMESTAMP(3),
  "oauthStateHash" TEXT,
  "oauthStateExpiresAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationSyncCursor" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "cursor" TEXT,
  "lastSuccessfulAt" TIMESTAMP(3),
  "itemsSeen" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationSyncCursor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationConnection_userId_provider_kind_key" ON "IntegrationConnection"("userId","provider","kind");
CREATE UNIQUE INDEX "IntegrationSyncCursor_connectionId_key" ON "IntegrationSyncCursor"("connectionId");
CREATE INDEX "IntegrationConnection_userId_status_idx" ON "IntegrationConnection"("userId","status");
CREATE INDEX "IntegrationConnection_organizationId_provider_kind_idx" ON "IntegrationConnection"("organizationId","provider","kind");
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IntegrationSyncCursor" ADD CONSTRAINT "IntegrationSyncCursor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
