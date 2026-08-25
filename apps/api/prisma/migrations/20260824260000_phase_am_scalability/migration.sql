-- PHASE AM: indexes for bounded, high-cardinality access paths.
CREATE INDEX IF NOT EXISTS "Relationship_sourceOrganizationId_deletedAt_status_idx"
  ON "Relationship"("sourceOrganizationId","deletedAt","status");
CREATE INDEX IF NOT EXISTS "Relationship_targetOrganizationId_deletedAt_status_idx"
  ON "Relationship"("targetOrganizationId","deletedAt","status");
CREATE INDEX IF NOT EXISTS "Relationship_sourceOrganizationId_targetOrganizationId_healthScore_idx"
  ON "Relationship"("sourceOrganizationId","targetOrganizationId","healthScore");
CREATE INDEX IF NOT EXISTS "PersonRelationship_sourcePersonId_deletedAt_status_idx"
  ON "PersonRelationship"("sourcePersonId","deletedAt","status");
CREATE INDEX IF NOT EXISTS "PersonRelationship_targetPersonId_deletedAt_status_idx"
  ON "PersonRelationship"("targetPersonId","deletedAt","status");
CREATE INDEX IF NOT EXISTS "Person_organizationId_deletedAt_id_idx"
  ON "Person"("organizationId","deletedAt","id");
CREATE INDEX IF NOT EXISTS "Project_organizationId_deletedAt_id_idx"
  ON "Project"("organizationId","deletedAt","id");
CREATE INDEX IF NOT EXISTS "Meeting_organizationId_deletedAt_startAt_idx"
  ON "Meeting"("organizationId","deletedAt","startAt");
CREATE INDEX IF NOT EXISTS "Opportunity_organizationId_deletedAt_updatedAt_idx"
  ON "Opportunity"("organizationId","deletedAt","updatedAt");
CREATE INDEX IF NOT EXISTS "Organization_parentOrganizationId_deletedAt_id_idx"
  ON "Organization"("parentOrganizationId","deletedAt","id");
