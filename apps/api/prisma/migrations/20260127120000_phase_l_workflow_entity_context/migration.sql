-- PHASE L: Workflow entity-context integrity
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "Action_organizationId_idx" ON "Action"("organizationId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Action_organizationId_fkey') THEN
    ALTER TABLE "Action" ADD CONSTRAINT "Action_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
