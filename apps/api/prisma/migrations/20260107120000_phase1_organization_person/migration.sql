CREATE TABLE "OrganizationPerson" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "roleTitle" TEXT,
  "department" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationPerson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationPerson_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationPerson_organizationId_personId_key" ON "OrganizationPerson"("organizationId", "personId");
CREATE INDEX "OrganizationPerson_personId_status_idx" ON "OrganizationPerson"("personId", "status");
CREATE INDEX "OrganizationPerson_organizationId_status_idx" ON "OrganizationPerson"("organizationId", "status");
CREATE INDEX "OrganizationPerson_personId_isPrimary_idx" ON "OrganizationPerson"("personId", "isPrimary");
