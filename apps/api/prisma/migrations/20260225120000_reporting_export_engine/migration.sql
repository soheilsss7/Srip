-- Reporting / Export permissions are data-plane prerequisites for the reporting API.
-- Idempotent and additive: no existing application data is deleted or altered.
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES
  ('00000000-0000-0000-0000-000000000f01', 'report.read', 'Read reporting datasets and executive reports', NOW()),
  ('00000000-0000-0000-0000-000000000f02', 'report.export', 'Export reporting datasets as CSV, Excel, PDF or JSON', NOW())
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("role", "permissionId")
SELECT r."key", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE p."key" = 'report.read'
  AND r."key" IN ('SUPER_ADMIN','HOLDING_ADMIN','HOLDING_EXECUTIVE','SUBSIDIARY_ADMIN','SUBSIDIARY_EXECUTIVE','RELATIONSHIP_MANAGER','PROJECT_MANAGER','ANALYST','STANDARD_USER','READ_ONLY')
ON CONFLICT ("role", "permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("role", "permissionId")
SELECT r."key", p."id"
FROM "Role" r CROSS JOIN "Permission" p
WHERE p."key" = 'report.export'
  AND r."key" IN ('SUPER_ADMIN','HOLDING_ADMIN','SUBSIDIARY_ADMIN')
ON CONFLICT ("role", "permissionId") DO NOTHING;
