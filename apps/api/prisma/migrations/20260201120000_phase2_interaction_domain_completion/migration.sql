-- Phase 2: Interaction / Meeting / Action / Commitment / Project / Opportunity completion.
ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

DO $$ BEGIN
  CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "reminderAt" TIMESTAMP(3);
ALTER TABLE "Action" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
DO $$ BEGIN
  ALTER TABLE "Action" ADD CONSTRAINT "Action_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "reminderAt" TIMESTAMP(3);
ALTER TABLE "Commitment" ADD COLUMN IF NOT EXISTS "recommendationId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Meeting_status_startAt_idx" ON "Meeting"("status", "startAt");
CREATE INDEX IF NOT EXISTS "Action_reminderAt_idx" ON "Action"("reminderAt");
CREATE INDEX IF NOT EXISTS "Commitment_reminderAt_idx" ON "Commitment"("reminderAt");
CREATE INDEX IF NOT EXISTS "Commitment_recommendationId_idx" ON "Commitment"("recommendationId");
