-- PHASE J: Domain Event Contract
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "recommendationId" TEXT;
CREATE INDEX IF NOT EXISTS "Action_recommendationId_idx" ON "Action"("recommendationId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Action_recommendationId_fkey') THEN
    ALTER TABLE "Action" ADD CONSTRAINT "Action_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
