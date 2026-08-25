-- Phase 5: Authorization and Multi-Tenancy foundation
CREATE TABLE "AuthorizationPolicy" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "permissionKey" TEXT NOT NULL,
  "effect" TEXT NOT NULL DEFAULT 'ALLOW',
  "role" TEXT,
  "organizationId" TEXT,
  "department" TEXT,
  "maxDataClassification" "DataClassification",
  "ownerOnly" BOOLEAN NOT NULL DEFAULT false,
  "conditions" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthorizationPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthorizationPolicy_key_key" ON "AuthorizationPolicy"("key");
CREATE INDEX "AuthorizationPolicy_permissionKey_enabled_idx" ON "AuthorizationPolicy"("permissionKey","enabled");
CREATE INDEX "AuthorizationPolicy_role_organizationId_idx" ON "AuthorizationPolicy"("role","organizationId");
CREATE INDEX "Membership_userId_isPrimary_idx" ON "Membership"("userId","isPrimary");
ALTER TABLE "AuthorizationPolicy" ADD CONSTRAINT "AuthorizationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthorizationPolicy" ADD CONSTRAINT "AuthorizationPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
