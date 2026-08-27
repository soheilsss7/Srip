CREATE TABLE "CustomField" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL,
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScoringRule" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scoreType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "definition" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScoringRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "NotificationRule" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "channels" JSONB NOT NULL,
  "conditions" JSONB,
  "template" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AiSetting" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScoringRule_key_key" ON "ScoringRule"("key");
CREATE UNIQUE INDEX "NotificationRule_key_key" ON "NotificationRule"("key");
CREATE INDEX "CustomField_entityType_active_idx" ON "CustomField"("entityType","active");
CREATE INDEX "CustomField_organizationId_active_idx" ON "CustomField"("organizationId","active");
CREATE INDEX "ScoringRule_entityType_active_idx" ON "ScoringRule"("entityType","active");
CREATE INDEX "ScoringRule_organizationId_active_idx" ON "ScoringRule"("organizationId","active");
CREATE INDEX "NotificationRule_eventType_active_idx" ON "NotificationRule"("eventType","active");
CREATE INDEX "NotificationRule_organizationId_active_idx" ON "NotificationRule"("organizationId","active");
CREATE INDEX "AiSetting_organizationId_active_idx" ON "AiSetting"("organizationId","active");
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScoringRule" ADD CONSTRAINT "ScoringRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoringRule" ADD CONSTRAINT "ScoringRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiSetting" ADD CONSTRAINT "AiSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSetting" ADD CONSTRAINT "AiSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
