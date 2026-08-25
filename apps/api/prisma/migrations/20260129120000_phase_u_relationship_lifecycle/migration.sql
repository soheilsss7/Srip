CREATE TYPE "RelationshipLifecycleStage" AS ENUM (
  'IDENTIFIED',
  'INTRODUCED',
  'INITIAL_CONTACT',
  'DEVELOPING',
  'ACTIVE',
  'STRATEGIC',
  'DORMANT',
  'AT_RISK',
  'LOST'
);

ALTER TABLE "Relationship"
ADD COLUMN "lifecycleStage" "RelationshipLifecycleStage" NOT NULL DEFAULT 'IDENTIFIED';

UPDATE "Relationship"
SET "lifecycleStage" = CASE "status"
  WHEN 'PROSPECTIVE' THEN 'IDENTIFIED'::"RelationshipLifecycleStage"
  WHEN 'ACTIVE' THEN 'ACTIVE'::"RelationshipLifecycleStage"
  WHEN 'AT_RISK' THEN 'AT_RISK'::"RelationshipLifecycleStage"
  WHEN 'DORMANT' THEN 'DORMANT'::"RelationshipLifecycleStage"
  WHEN 'ARCHIVED' THEN 'LOST'::"RelationshipLifecycleStage"
  ELSE 'IDENTIFIED'::"RelationshipLifecycleStage"
END;

CREATE INDEX "Relationship_lifecycleStage_idx" ON "Relationship"("lifecycleStage");
