-- Phase 23 contract reconciliation.
-- This migration is additive and preserves all existing rows.

-- Canonical RelationshipType entity reuses the existing catalog table.
-- Canonical ProjectRequirement entity reuses the existing Requirement table.

-- Canonical InteractionType catalog.
-- Rename the legacy PostgreSQL enum first so the new table can use the exact domain entity name.
ALTER TYPE "InteractionType" RENAME TO "InteractionKind";

CREATE TABLE IF NOT EXISTS "InteractionType" (
  "id" TEXT NOT NULL,
  "key" "InteractionKind" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InteractionType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InteractionType_key_key" ON "InteractionType"("key");
CREATE INDEX IF NOT EXISTS "InteractionType_isActive_idx" ON "InteractionType"("isActive");

-- RelationshipType reference on Relationship while retaining relationshipType
-- as the stable API/display key for backward compatibility.
ALTER TABLE "Relationship" ADD COLUMN IF NOT EXISTS "relationshipTypeId" TEXT;

INSERT INTO "RelationshipTypeCatalog" ("id", "key", "name", "description", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'STRATEGIC', 'Strategic', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "RelationshipTypeCatalog" WHERE "key" = 'STRATEGIC');

UPDATE "Relationship"
SET "relationshipTypeId" = rtc."id"
FROM "RelationshipTypeCatalog" rtc
WHERE "Relationship"."relationshipType" = rtc."key"
  AND "Relationship"."relationshipTypeId" IS NULL;

CREATE INDEX IF NOT EXISTS "Relationship_relationshipTypeId_idx" ON "Relationship"("relationshipTypeId");
ALTER TABLE "Relationship"
  ADD CONSTRAINT "Relationship_relationshipTypeId_fkey"
  FOREIGN KEY ("relationshipTypeId") REFERENCES "RelationshipTypeCatalog"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- InteractionType reference. Existing enum values are retained for API compatibility.
ALTER TABLE "Interaction" ADD COLUMN IF NOT EXISTS "interactionTypeId" TEXT;

INSERT INTO "InteractionType" ("id", "key", "name", "description", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CALL', 'Call', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'EMAIL', 'Email', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MEETING', 'Meeting', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'NOTE', 'Note', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MESSAGE', 'Message', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OTHER', 'Other', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "name" = EXCLUDED."name", "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Interaction" i
SET "interactionTypeId" = it."id"
FROM "InteractionType" it
WHERE i."type"::text = it."key"::text
  AND i."interactionTypeId" IS NULL;

CREATE INDEX IF NOT EXISTS "Interaction_interactionTypeId_idx" ON "Interaction"("interactionTypeId");
ALTER TABLE "Interaction"
  ADD CONSTRAINT "Interaction_interactionTypeId_fkey"
  FOREIGN KEY ("interactionTypeId") REFERENCES "InteractionType"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Canonical generic Score entity and immutable ScoreSnapshot history.
CREATE TABLE IF NOT EXISTS "Score" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "explanation" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Score_type_subjectType_subjectId_idx" ON "Score"("type", "subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "Score_subjectType_subjectId_createdAt_idx" ON "Score"("subjectType", "subjectId", "createdAt");

CREATE TABLE IF NOT EXISTS "ScoreSnapshot" (
  "id" TEXT NOT NULL,
  "scoreId" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "version" INTEGER NOT NULL,
  "explanation" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScoreSnapshot_scoreId_createdAt_idx" ON "ScoreSnapshot"("scoreId", "createdAt");
ALTER TABLE "ScoreSnapshot"
  ADD CONSTRAINT "ScoreSnapshot_scoreId_fkey"
  FOREIGN KEY ("scoreId") REFERENCES "Score"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
