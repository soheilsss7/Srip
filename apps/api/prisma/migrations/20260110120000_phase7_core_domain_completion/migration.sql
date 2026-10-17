ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "englishName" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "strategicImportance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Relationship" ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "OrganizationUnit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "parentUnitId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'DEPARTMENT',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrganizationUnit_organizationId_status_idx" ON "OrganizationUnit"("organizationId","status");
CREATE INDEX IF NOT EXISTS "OrganizationUnit_parentUnitId_idx" ON "OrganizationUnit"("parentUnitId");
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ContactInformation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "personId" TEXT,
  "organizationUnitId" TEXT,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "label" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactInformation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContactInformation_organizationId_kind_idx" ON "ContactInformation"("organizationId","kind");
CREATE INDEX IF NOT EXISTS "ContactInformation_personId_kind_idx" ON "ContactInformation"("personId","kind");
CREATE INDEX IF NOT EXISTS "ContactInformation_organizationUnitId_kind_idx" ON "ContactInformation"("organizationUnitId","kind");
ALTER TABLE "ContactInformation" ADD CONSTRAINT "ContactInformation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactInformation" ADD CONSTRAINT "ContactInformation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactInformation" ADD CONSTRAINT "ContactInformation_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "RelationshipTypeCatalog" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RelationshipTypeCatalog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RelationshipTypeCatalog_key_key" ON "RelationshipTypeCatalog"("key");
