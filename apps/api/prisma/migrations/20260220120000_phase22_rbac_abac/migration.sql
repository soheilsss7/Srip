CREATE TYPE "AccessScopeType" AS ENUM ('ORGANIZATION','SUBSIDIARIES','DEPARTMENT','OWNED','SHARED','PRIVATE');

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");
CREATE INDEX "Role_isActive_idx" ON "Role"("isActive");

INSERT INTO "Role" ("id","key","name","description","isSystem","isActive","updatedAt") VALUES
('role-super-admin','SUPER_ADMIN','Super Admin','Global platform administrator',true,true,CURRENT_TIMESTAMP),
('role-holding-admin','HOLDING_ADMIN','Holding Admin','Administrator across a holding and its subsidiaries',true,true,CURRENT_TIMESTAMP),
('role-holding-executive','HOLDING_EXECUTIVE','Holding Executive','Executive read/access role across a holding',true,true,CURRENT_TIMESTAMP),
('role-subsidiary-admin','SUBSIDIARY_ADMIN','Subsidiary Admin','Administrator within a subsidiary',true,true,CURRENT_TIMESTAMP),
('role-subsidiary-executive','SUBSIDIARY_EXECUTIVE','Subsidiary Executive','Executive role within a subsidiary',true,true,CURRENT_TIMESTAMP),
('role-relationship-manager','RELATIONSHIP_MANAGER','Relationship Manager','Relationship and network management role',true,true,CURRENT_TIMESTAMP),
('role-project-manager','PROJECT_MANAGER','Project Manager','Project delivery management role',true,true,CURRENT_TIMESTAMP),
('role-analyst','ANALYST','Analyst','Analysis and reporting role',true,true,CURRENT_TIMESTAMP),
('role-standard-user','STANDARD_USER','Standard User','Standard application user',true,true,CURRENT_TIMESTAMP),
('role-read-only','READ_ONLY','Read Only','Read-only application user',true,true,CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Role" ("id","key","name","description","isSystem","isActive","updatedAt")
SELECT 'role-legacy-' || md5(src."key"), src."key", src."key", 'Legacy role migrated during RBAC reconciliation', false, true, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "role" AS "key" FROM "Membership"
  UNION
  SELECT DISTINCT "role" AS "key" FROM "RolePermission"
) src
WHERE NOT EXISTS (SELECT 1 FROM "Role" r WHERE r."key" = src."key");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("key") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Membership" ADD COLUMN "departmentUnitId" TEXT;
ALTER TABLE "Membership" ADD COLUMN "accessScope" "AccessScopeType" NOT NULL DEFAULT 'ORGANIZATION';
ALTER TABLE "Membership" ADD COLUMN "scope" JSONB;
CREATE INDEX "Membership_departmentUnitId_idx" ON "Membership"("departmentUnitId");
CREATE INDEX "Membership_userId_accessScope_idx" ON "Membership"("userId","accessScope");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_departmentUnitId_fkey" FOREIGN KEY ("departmentUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Relationship" ADD COLUMN "sensitivity" "DataClassification" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "AuthorizationPolicy" ADD COLUMN "subjectScope" "AccessScopeType";

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "AuthorizationPolicy_role_organization_enabled_idx" ON "AuthorizationPolicy"("role","organizationId","enabled");
CREATE INDEX "AuthorizationPolicy_subjectScope_idx" ON "AuthorizationPolicy"("subjectScope");
