-- معیارهای واقعی ارزیابی رابطه: پاسخ‌ها، تصاویر ارزیابی، تنظیم محلی و تقویم بازبینی
CREATE TYPE "CriteriaSubjectType" AS ENUM ('ORGANIZATION','PERSON','RELATIONSHIP','OPPORTUNITY');
CREATE TYPE "CriteriaAnswerMethod" AS ENUM ('SELF_REPORTED','OWNER_ASSESSED','DOCUMENT','VERIFIED','INFERRED');
CREATE TYPE "CriteriaReviewStatus" AS ENUM ('UNREVIEWED','REVIEWED','DISPUTED');

CREATE TABLE "CriteriaAnswer" (
  "id" TEXT NOT NULL,
  "subjectType" "CriteriaSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "criterionCode" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "level" INTEGER,
  "value" INTEGER,
  "note" TEXT,
  "evidence" TEXT,
  "evidenceRefs" JSONB,
  "method" "CriteriaAnswerMethod" NOT NULL DEFAULT 'OWNER_ASSESSED',
  "reviewStatus" "CriteriaReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "source" TEXT,
  "answeredById" TEXT,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "CriteriaAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CriteriaAnswer_subjectType_subjectId_criterionCode_key" ON "CriteriaAnswer"("subjectType","subjectId","criterionCode");
CREATE INDEX "CriteriaAnswer_organizationId_subjectType_idx" ON "CriteriaAnswer"("organizationId","subjectType");
CREATE INDEX "CriteriaAnswer_subjectType_subjectId_idx" ON "CriteriaAnswer"("subjectType","subjectId");
CREATE INDEX "CriteriaAnswer_criterionCode_idx" ON "CriteriaAnswer"("criterionCode");
CREATE INDEX "CriteriaAnswer_answeredAt_idx" ON "CriteriaAnswer"("answeredAt");
ALTER TABLE "CriteriaAnswer" ADD CONSTRAINT "CriteriaAnswer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriteriaAnswer" ADD CONSTRAINT "CriteriaAnswer_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CriteriaSnapshot" (
  "id" TEXT NOT NULL,
  "subjectType" "CriteriaSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "modelVersion" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "rawScore" INTEGER NOT NULL,
  "coverage" INTEGER NOT NULL,
  "confidence" INTEGER NOT NULL,
  "uncertainty" INTEGER NOT NULL,
  "rankable" BOOLEAN NOT NULL DEFAULT false,
  "flags" JSONB,
  "payload" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CriteriaSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CriteriaSnapshot_subjectType_subjectId_createdAt_idx" ON "CriteriaSnapshot"("subjectType","subjectId","createdAt");
CREATE INDEX "CriteriaSnapshot_organizationId_createdAt_idx" ON "CriteriaSnapshot"("organizationId","createdAt");
ALTER TABLE "CriteriaSnapshot" ADD CONSTRAINT "CriteriaSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CriteriaSnapshot" ADD CONSTRAINT "CriteriaSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CriteriaOverride" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "subjectType" "CriteriaSubjectType" NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'DEFAULT',
  "familyWeights" JSONB,
  "criterionWeights" JSONB,
  "minCoverageForRanking" INTEGER NOT NULL DEFAULT 40,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CriteriaOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CriteriaOverride_organizationId_subjectType_scope_key" ON "CriteriaOverride"("organizationId","subjectType","scope");
CREATE INDEX "CriteriaOverride_subjectType_idx" ON "CriteriaOverride"("subjectType");

CREATE TABLE "CriteriaReviewTask" (
  "id" TEXT NOT NULL,
  "subjectType" "CriteriaSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "organizationId" TEXT,
  "criterionCode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "CriteriaReviewTask_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CriteriaReviewTask_subjectType_subjectId_criterionCode_key" ON "CriteriaReviewTask"("subjectType","subjectId","criterionCode");
CREATE INDEX "CriteriaReviewTask_status_dueAt_idx" ON "CriteriaReviewTask"("status","dueAt");
CREATE INDEX "CriteriaReviewTask_organizationId_idx" ON "CriteriaReviewTask"("organizationId");
