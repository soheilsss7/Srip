-- Phase 4: Authentication foundation.
ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'OIDC', 'SAML');

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Account_userId_provider_key" ON "Account"("userId", "provider");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IdentityProvider" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" "AuthProvider" NOT NULL,
  "issuerUrl" TEXT NOT NULL,
  "discoveryUrl" TEXT,
  "clientId" TEXT NOT NULL,
  "clientSecretEncrypted" TEXT,
  "scopes" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdentityProvider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdentityProvider_name_key" ON "IdentityProvider"("name");
CREATE INDEX "IdentityProvider_provider_enabled_idx" ON "IdentityProvider"("provider", "enabled");

ALTER TABLE "Session"
  ADD COLUMN "rotatedAt" TIMESTAMP(3),
  ADD COLUMN "tokenFamilyId" TEXT;
  ALTER TABLE "Session"
  ADD COLUMN "replacedBySessionId" TEXT;
UPDATE "Session" SET "tokenFamilyId" = "id" WHERE "tokenFamilyId" IS NULL;
ALTER TABLE "Session" ALTER COLUMN "tokenFamilyId" SET NOT NULL;
CREATE INDEX "Session_tokenFamilyId_revokedAt_idx" ON "Session"("tokenFamilyId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
