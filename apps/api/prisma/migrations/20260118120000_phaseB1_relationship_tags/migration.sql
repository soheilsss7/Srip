CREATE TABLE "RelationshipTag" (
  "relationshipId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelationshipTag_pkey" PRIMARY KEY ("relationshipId","tagId")
);

CREATE INDEX "RelationshipTag_tagId_idx" ON "RelationshipTag"("tagId");
CREATE INDEX "RelationshipTag_relationshipId_idx" ON "RelationshipTag"("relationshipId");

ALTER TABLE "RelationshipTag"
  ADD CONSTRAINT "RelationshipTag_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelationshipTag"
  ADD CONSTRAINT "RelationshipTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
