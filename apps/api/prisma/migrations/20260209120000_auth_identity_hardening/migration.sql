-- Authentication & Identity hardening: OIDC account linking and session security windows.
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_provider_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Account_userId_provider_providerAccountId_key" ON "Account"("userId", "provider", "providerAccountId");
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "idleExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "absoluteExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Session" SET "absoluteExpiresAt" = "expiresAt", "idleExpiresAt" = LEAST("expiresAt", CURRENT_TIMESTAMP + INTERVAL '8 hours') WHERE "absoluteExpiresAt" = CURRENT_TIMESTAMP OR "idleExpiresAt" = CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Session_idleExpiresAt_idx" ON "Session"("idleExpiresAt");
CREATE INDEX IF NOT EXISTS "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");
