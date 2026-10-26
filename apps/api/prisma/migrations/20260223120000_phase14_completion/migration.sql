ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'IN_APP';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deepLink" TEXT;
ALTER TABLE "WorkflowExecution" ADD COLUMN IF NOT EXISTS "resumeAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "WorkflowExecution_resumeAt_status_idx" ON "WorkflowExecution"("resumeAt", "status");
CREATE INDEX IF NOT EXISTS "Notification_userId_priority_createdAt_idx" ON "Notification"("userId", "priority", "createdAt");
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "organizationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_feature_createdAt_idx" ON "AnalyticsEvent"("feature", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_organizationId_createdAt_idx" ON "AnalyticsEvent"("organizationId", "createdAt");
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Optional PostgreSQL full-text indexes for the highest-volume search entities.
CREATE INDEX IF NOT EXISTS "Organization_search_fts_idx" ON "Organization" USING GIN (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("legalName",'')));
CREATE INDEX IF NOT EXISTS "Person_search_fts_idx" ON "Person" USING GIN (to_tsvector('simple', coalesce("firstName",'') || ' ' || coalesce("lastName",'') || ' ' || coalesce("email",'')));
CREATE INDEX IF NOT EXISTS "Project_search_fts_idx" ON "Project" USING GIN (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce("objective",'')));
CREATE INDEX IF NOT EXISTS "Relationship_search_fts_idx" ON "Relationship" USING GIN (to_tsvector('simple', coalesce("relationshipType",'') || ' ' || coalesce(srip_enum_text("status"), '')));
CREATE INDEX IF NOT EXISTS "Meeting_search_fts_idx" ON "Meeting" USING GIN (to_tsvector('simple', coalesce("title",'') || ' ' || coalesce("objective",'') || ' ' || coalesce("agenda",'') || ' ' || coalesce("notes",'') || ' ' || coalesce("outcome",'') || ' ' || coalesce("transcript",'')));
CREATE INDEX IF NOT EXISTS "Interaction_search_fts_idx" ON "Interaction" USING GIN (to_tsvector('simple', coalesce("subject",'') || ' ' || coalesce("summary",'') || ' ' || coalesce("outcome",'')));
CREATE INDEX IF NOT EXISTS "Opportunity_search_fts_idx" ON "Opportunity" USING GIN (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("description",'') || ' ' || coalesce(srip_enum_text("status"), '')));
CREATE INDEX IF NOT EXISTS "Document_search_fts_idx" ON "Document" USING GIN (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("mimeType",'') || ' ' || coalesce("storageKey",'')));
CREATE INDEX IF NOT EXISTS "Note_search_fts_idx" ON "Note" USING GIN (to_tsvector('simple', coalesce("title",'') || ' ' || coalesce("body",'')));
