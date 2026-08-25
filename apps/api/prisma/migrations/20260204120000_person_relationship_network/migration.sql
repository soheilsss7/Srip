CREATE TABLE "PersonRelationship" (
  "id" TEXT NOT NULL,
  "sourcePersonId" TEXT NOT NULL,
  "targetPersonId" TEXT NOT NULL,
  "sourceOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "relationshipTypeId" TEXT,
  "status" "RelationshipStatus" NOT NULL DEFAULT 'PROSPECTIVE',
  "healthScore" INTEGER NOT NULL DEFAULT 0,
  "strategicScore" INTEGER NOT NULL DEFAULT 0,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "trustScore" INTEGER NOT NULL DEFAULT 0,
  "accessScore" INTEGER NOT NULL DEFAULT 0,
  "influenceScore" INTEGER NOT NULL DEFAULT 0,
  "opportunityScore" INTEGER NOT NULL DEFAULT 0,
  "resilienceScore" INTEGER NOT NULL DEFAULT 0,
  "sensitivity" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
  "engagementScore" INTEGER NOT NULL DEFAULT 0,
  "ownerId" TEXT,
  "backupOwnerId" TEXT,
  "reviewCadenceDays" INTEGER NOT NULL DEFAULT 90,
  "lastInteractionAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "nextActionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "PersonRelationship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonRelationship_sourcePersonId_targetPersonId_relationshipType_key" ON "PersonRelationship"("sourcePersonId", "targetPersonId", "relationshipType");
CREATE INDEX "PersonRelationship_sourceOrganizationId_targetOrganizationId_idx" ON "PersonRelationship"("sourceOrganizationId", "targetOrganizationId");
CREATE INDEX "PersonRelationship_status_idx" ON "PersonRelationship"("status");
CREATE INDEX "PersonRelationship_ownerId_idx" ON "PersonRelationship"("ownerId");
CREATE INDEX "PersonRelationship_sourcePersonId_idx" ON "PersonRelationship"("sourcePersonId");
CREATE INDEX "PersonRelationship_targetPersonId_idx" ON "PersonRelationship"("targetPersonId");
CREATE INDEX "PersonRelationship_deletedAt_idx" ON "PersonRelationship"("deletedAt");

ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_sourcePersonId_fkey" FOREIGN KEY ("sourcePersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_relationshipTypeId_fkey" FOREIGN KEY ("relationshipTypeId") REFERENCES "RelationshipTypeCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_backupOwnerId_fkey" FOREIGN KEY ("backupOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
