-- Align the Organization FTS index with the canonical search expression used by SearchService.
DROP INDEX IF EXISTS "Organization_search_fts_idx";
CREATE INDEX IF NOT EXISTS "Organization_search_fts_idx"
  ON "Organization" USING GIN (to_tsvector('simple', coalesce("name",'') || ' ' || coalesce("legalName",'') || ' ' || coalesce("englishName",'') || ' ' || coalesce("displayName",'')));
