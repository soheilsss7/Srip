-- PHASE Y: Recommendation Product Analytics funnel.
-- AnalyticsEvent already exists; this index accelerates metadata-based recommendationId lookup.
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_metadata_gin_idx"
  ON "AnalyticsEvent" USING GIN ("metadata");
