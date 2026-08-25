ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'UPLOADED';
ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'MAPPED';
ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'VALIDATING';
CREATE TYPE "ImportPipelineStage" AS ENUM ('UPLOAD','MAPPING','VALIDATION','DUPLICATE_DETECTION','PREVIEW','APPROVAL','IMPORT','REPORT');
ALTER TABLE "DataImport" ADD COLUMN "pipelineStage" "ImportPipelineStage" NOT NULL DEFAULT 'UPLOAD';
CREATE INDEX "DataImport_pipelineStage_createdAt_idx" ON "DataImport"("pipelineStage","createdAt");
UPDATE "DataImport" SET "pipelineStage"='PREVIEW' WHERE "status" IN ('PREVIEWED','APPROVED');
UPDATE "DataImport" SET "pipelineStage"='IMPORT' WHERE "status"='PROCESSING';
UPDATE "DataImport" SET "pipelineStage"='REPORT' WHERE "status" IN ('COMPLETED','FAILED','REJECTED');
