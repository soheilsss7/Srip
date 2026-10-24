-- Phase D: Custom Fields value storage and integrity.
CREATE TABLE "CustomFieldValue" (
  "id" TEXT NOT NULL,
  "customFieldId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "stringValue" TEXT,
  "numberValue" DECIMAL(65,30),
  "booleanValue" BOOLEAN,
  "dateValue" TIMESTAMP(3),
  "jsonValue" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomFieldValue_customFieldId_entityType_entityId_key"
  ON "CustomFieldValue"("customFieldId","entityType","entityId");
CREATE INDEX "CustomFieldValue_entityType_entityId_idx"
  ON "CustomFieldValue"("entityType","entityId");
CREATE INDEX "CustomFieldValue_customFieldId_idx"
  ON "CustomFieldValue"("customFieldId");

ALTER TABLE "CustomFieldValue"
  ADD CONSTRAINT "CustomFieldValue_customFieldId_fkey"
  FOREIGN KEY ("customFieldId") REFERENCES "CustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one typed value column must be populated.
ALTER TABLE "CustomFieldValue"
  ADD CONSTRAINT "CustomFieldValue_exactly_one_value_ck"
  CHECK (((CASE WHEN "stringValue" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "numberValue" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "booleanValue" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "dateValue" IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN "jsonValue" IS NOT NULL THEN 1 ELSE 0 END)) = 1);

-- Custom field keys are unique within an organization and entity type.
CREATE UNIQUE INDEX "CustomField_organizationId_entityType_key_key"
  ON "CustomField"("organizationId","entityType","key");

-- PostgreSQL treats NULLs as distinct in UNIQUE indexes; enforce uniqueness for global fields too.
CREATE UNIQUE INDEX "CustomField_global_entityType_key_key"
  ON "CustomField"("entityType","key")
  WHERE "organizationId" IS NULL;
