-- تفکیک بازاری / غیربازاری + نقطه ورود به بازار برای Relationship و PersonRelationship
CREATE TYPE "RelationshipMarketKind" AS ENUM ('MARKET', 'NON_MARKET', 'HYBRID');

ALTER TABLE "Relationship" ADD COLUMN "marketKind" "RelationshipMarketKind" NOT NULL DEFAULT 'MARKET';
ALTER TABLE "Relationship" ADD COLUMN "isMarketEntry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Relationship" ADD COLUMN "marketSegment" TEXT;

CREATE INDEX "Relationship_marketKind_idx" ON "Relationship"("marketKind");
CREATE INDEX "Relationship_isMarketEntry_idx" ON "Relationship"("isMarketEntry");
CREATE INDEX "Relationship_marketKind_status_idx" ON "Relationship"("marketKind", "status");
CREATE INDEX "Relationship_marketSegment_idx" ON "Relationship"("marketSegment");

ALTER TABLE "PersonRelationship" ADD COLUMN "marketKind" "RelationshipMarketKind" NOT NULL DEFAULT 'MARKET';
ALTER TABLE "PersonRelationship" ADD COLUMN "isMarketEntry" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonRelationship" ADD COLUMN "marketSegment" TEXT;

CREATE INDEX "PersonRelationship_marketKind_idx" ON "PersonRelationship"("marketKind");
CREATE INDEX "PersonRelationship_isMarketEntry_idx" ON "PersonRelationship"("isMarketEntry");
