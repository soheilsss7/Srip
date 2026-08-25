-- PHASE AL performance indexes. All indexes are additive and target the read paths
-- used by organization/person/relationship lists, search analytics, dashboards and reporting.
CREATE INDEX IF NOT EXISTS "Organization_status_deletedAt_name_idx" ON "Organization" ("status", "deletedAt", "name");
CREATE INDEX IF NOT EXISTS "Person_organizationId_deletedAt_lastName_firstName_idx" ON "Person" ("organizationId", "deletedAt", "lastName", "firstName");
CREATE INDEX IF NOT EXISTS "Relationship_deletedAt_status_updatedAt_idx" ON "Relationship" ("deletedAt", "status", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Relationship_source_target_deletedAt_updatedAt_idx" ON "Relationship" ("sourceOrganizationId", "targetOrganizationId", "deletedAt", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Relationship_target_source_deletedAt_updatedAt_idx" ON "Relationship" ("targetOrganizationId", "sourceOrganizationId", "deletedAt", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Interaction_organization_occurredAt_deletedAt_idx" ON "Interaction" ("organizationId", "occurredAt" DESC, "deletedAt");
CREATE INDEX IF NOT EXISTS "Meeting_organization_startAt_deletedAt_idx" ON "Meeting" ("organizationId", "startAt" DESC, "deletedAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_feature_createdAt_organizationId_idx" ON "AnalyticsEvent" ("feature", "createdAt" DESC, "organizationId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_organizationId_idx" ON "AnalyticsEvent" ("type", "createdAt" DESC, "organizationId");
CREATE INDEX IF NOT EXISTS "Action_organization_status_dueAt_deletedAt_idx" ON "Action" ("organizationId", "status", "dueAt", "deletedAt");
CREATE INDEX IF NOT EXISTS "Commitment_organization_status_dueAt_deletedAt_idx" ON "Commitment" ("organizationId", "status", "dueAt", "deletedAt");
