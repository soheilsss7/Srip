CREATE TYPE "ImportEntityType" AS ENUM ('ORGANIZATION','PERSON');
CREATE TYPE "ImportFormat" AS ENUM ('CSV','XLSX','XLS');
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEWED','APPROVED','PROCESSING','COMPLETED','REJECTED','FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID','INVALID','DUPLICATE','IMPORTED','SKIPPED','UPDATED');
CREATE TYPE "DuplicateStrategy" AS ENUM ('SKIP','UPDATE','CREATE');

CREATE TABLE "DataImport" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "entityType" "ImportEntityType" NOT NULL,
  "format" "ImportFormat" NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEWED',
  "sourceFileName" TEXT NOT NULL,
  "sourceMimeType" TEXT NOT NULL,
  "sourceSizeBytes" INTEGER NOT NULL,
  "mapping" JSONB NOT NULL,
  "duplicateStrategy" "DuplicateStrategy" NOT NULL DEFAULT 'SKIP',
  "summary" JSONB,
  "errorSummary" JSONB,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataImport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataImportRow" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "status" "ImportRowStatus" NOT NULL DEFAULT 'VALID',
  "errors" JSONB,
  "warnings" JSONB,
  "targetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataImportRow_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataImportDuplicate" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "rowId" TEXT NOT NULL,
  "entityType" "ImportEntityType" NOT NULL,
  "candidateId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "reasons" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataImportDuplicate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DataQualitySnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "createdById" TEXT NOT NULL,
  "metrics" JSONB NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataQualitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DataImportRow_importId_rowNumber_key" ON "DataImportRow"("importId","rowNumber");
CREATE INDEX "DataImport_organizationId_createdAt_idx" ON "DataImport"("organizationId","createdAt");
CREATE INDEX "DataImport_requestedById_createdAt_idx" ON "DataImport"("requestedById","createdAt");
CREATE INDEX "DataImport_status_createdAt_idx" ON "DataImport"("status","createdAt");
CREATE INDEX "DataImportRow_importId_status_idx" ON "DataImportRow"("importId","status");
CREATE INDEX "DataImportRow_targetId_idx" ON "DataImportRow"("targetId");
CREATE UNIQUE INDEX "DataImportDuplicate_rowId_candidateId_key" ON "DataImportDuplicate"("rowId","candidateId");
CREATE INDEX "DataImportDuplicate_importId_score_idx" ON "DataImportDuplicate"("importId","score");
CREATE INDEX "DataImportDuplicate_candidateId_idx" ON "DataImportDuplicate"("candidateId");
CREATE INDEX "DataQualitySnapshot_organizationId_scannedAt_idx" ON "DataQualitySnapshot"("organizationId","scannedAt");
CREATE INDEX "DataQualitySnapshot_createdById_createdAt_idx" ON "DataQualitySnapshot"("createdById","createdAt");
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataImportRow" ADD CONSTRAINT "DataImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DataImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataImportDuplicate" ADD CONSTRAINT "DataImportDuplicate_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DataImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataImportDuplicate" ADD CONSTRAINT "DataImportDuplicate_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "DataImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataQualitySnapshot" ADD CONSTRAINT "DataQualitySnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataQualitySnapshot" ADD CONSTRAINT "DataQualitySnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id","key","description","createdAt") VALUES
 ('00000000-0000-0000-0000-000000001101','data.import','Preview and manage data imports',NOW()),
 ('00000000-0000-0000-0000-000000001102','data.import.approve','Approve and execute data imports',NOW()),
 ('00000000-0000-0000-0000-000000001103','data.quality.read','Read data quality and duplicate reports',NOW()),
 ('00000000-0000-0000-0000-000000001104','data.quality.execute','Run data quality scans',NOW())
ON CONFLICT ("key") DO UPDATE SET "description"=EXCLUDED."description";
INSERT INTO "RolePermission" ("role","permissionId") SELECT r."key",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE p."key" IN ('data.import','data.import.approve','data.quality.read','data.quality.execute') AND r."key" IN ('SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("role","permissionId") SELECT r."key",p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE p."key"='data.quality.read' AND r."key" IN ('HOLDING_EXECUTIVE','SUBSIDIARY_EXECUTIVE','RELATIONSHIP_MANAGER','PROJECT_MANAGER','ANALYST') ON CONFLICT DO NOTHING;
