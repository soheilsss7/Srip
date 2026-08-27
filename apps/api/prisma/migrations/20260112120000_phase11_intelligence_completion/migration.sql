CREATE TABLE "ScoreVersion" ("id" TEXT NOT NULL,"name" TEXT NOT NULL,"version" INTEGER NOT NULL,"status" TEXT NOT NULL DEFAULT 'DRAFT',"weights" JSONB NOT NULL,"calibrationNotes" TEXT,"createdById" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ScoreVersion_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ScoreCalibration" ("id" TEXT NOT NULL,"scoreVersionId" TEXT NOT NULL,"relationshipId" TEXT,"observedOutcome" TEXT NOT NULL,"expectedScore" INTEGER NOT NULL,"observedScore" INTEGER NOT NULL,"notes" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ScoreCalibration_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ScoreVersion_name_version_key" ON "ScoreVersion"("name","version");
CREATE INDEX "ScoreVersion_status_idx" ON "ScoreVersion"("status");
CREATE INDEX "ScoreCalibration_scoreVersionId_createdAt_idx" ON "ScoreCalibration"("scoreVersionId","createdAt");
CREATE INDEX "ScoreCalibration_relationshipId_idx" ON "ScoreCalibration"("relationshipId");
ALTER TABLE "ScoreVersion" ADD CONSTRAINT "ScoreVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScoreCalibration" ADD CONSTRAINT "ScoreCalibration_scoreVersionId_fkey" FOREIGN KEY ("scoreVersionId") REFERENCES "ScoreVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreCalibration" ADD CONSTRAINT "ScoreCalibration_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
