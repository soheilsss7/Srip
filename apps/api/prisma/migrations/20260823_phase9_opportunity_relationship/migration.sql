-- Phase 9: link opportunities to relationships.
ALTER TABLE "Opportunity" ADD COLUMN "relationshipId" TEXT;
CREATE INDEX "Opportunity_relationshipId_idx" ON "Opportunity"("relationshipId");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
