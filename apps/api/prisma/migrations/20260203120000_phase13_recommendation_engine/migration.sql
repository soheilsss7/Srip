ALTER TABLE "Recommendation" ADD COLUMN "targetId" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "assignedToId" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "decisionById" TEXT;
ALTER TABLE "Recommendation" ADD COLUMN "decisionAt" TIMESTAMP(3);
ALTER TABLE "Recommendation" ADD COLUMN "snoozedUntil" TIMESTAMP(3);
ALTER TABLE "Recommendation" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Recommendation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Recommendation_relationshipId_status_idx" ON "Recommendation"("relationshipId", "status");
CREATE INDEX "Recommendation_assignedToId_status_idx" ON "Recommendation"("assignedToId", "status");
