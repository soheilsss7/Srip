ALTER TYPE "DataClassification" ADD VALUE IF NOT EXISTS 'HIGHLY_CONFIDENTIAL';
CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS','EXPORT','ERASURE');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING','PROCESSING','COMPLETED','REJECTED');
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED','REVOKED');
CREATE TYPE "DataLifecycleState" AS ENUM ('CREATION','ACTIVE','ARCHIVED','RETENTION','DELETION');
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT','CONTRACT','LEGAL_OBLIGATION','LEGITIMATE_INTEREST','VITAL_INTEREST','PUBLIC_TASK');
CREATE TYPE "FileUploadStatus" AS ENUM ('QUARANTINED','READY','REJECTED');
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING','CLEAN','INFECTED','ERROR','NOT_REQUIRED');

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "uploadStatus" "FileUploadStatus" NOT NULL DEFAULT 'READY';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "scannedAt" TIMESTAMP(3);

CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_userId_type_status_idx" ON "PrivacyRequest"("userId","type","status");
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status","createdAt");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConsentRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
  "source" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConsentRecord_userId_purpose_version_key" UNIQUE ("userId","purpose","version")
);
CREATE INDEX "ConsentRecord_userId_purpose_status_idx" ON "ConsentRecord"("userId","purpose","status");
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DataProcessingPolicy" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "legalBasis" "LegalBasis" NOT NULL,
  "classification" "DataClassification" NOT NULL DEFAULT 'INTERNAL',
  "retentionDays" INTEGER,
  "exportable" BOOLEAN NOT NULL DEFAULT true,
  "erasable" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataProcessingPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataProcessingPolicy_entityType_purpose_key" UNIQUE ("entityType","purpose")
);
CREATE INDEX "DataProcessingPolicy_entityType_active_idx" ON "DataProcessingPolicy"("entityType","active");

CREATE TABLE "DataLifecycleRecord" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "state" "DataLifecycleState" NOT NULL,
  "reason" TEXT,
  "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DataLifecycleRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataLifecycleRecord_entityType_entityId_transitionedAt_idx" ON "DataLifecycleRecord"("entityType","entityId","transitionedAt");
CREATE INDEX "DataLifecycleRecord_state_transitionedAt_idx" ON "DataLifecycleRecord"("state","transitionedAt");

CREATE TABLE "FileSecurityScan" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "FileScanStatus" NOT NULL,
  "scanner" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "detectedMimeType" TEXT,
  "signatureName" TEXT,
  "quarantineKey" TEXT,
  "details" JSONB,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileSecurityScan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FileSecurityScan_documentId_scannedAt_idx" ON "FileSecurityScan"("documentId","scannedAt");
CREATE INDEX "FileSecurityScan_status_scannedAt_idx" ON "FileSecurityScan"("status","scannedAt");
CREATE INDEX "FileSecurityScan_sha256_idx" ON "FileSecurityScan"("sha256");
ALTER TABLE "FileSecurityScan" ADD CONSTRAINT "FileSecurityScan_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
