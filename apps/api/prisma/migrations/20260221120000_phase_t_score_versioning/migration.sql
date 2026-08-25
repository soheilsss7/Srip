-- PHASE T: Score Versioning administration permission.
-- Data-only migration: ScoreVersion already exists; no schema rewrite is required.
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES (
  'phase_t_scoring_admin_permission',
  'scoring.admin',
  'Create, edit, activate and calibrate score versions and industry scoring policies',
  NOW()
)
ON CONFLICT ("key") DO UPDATE
SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("role", "permissionId")
SELECT r."key", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."key" = 'scoring.admin'
  AND r."key" IN ('SUPER_ADMIN', 'HOLDING_ADMIN', 'SUBSIDIARY_ADMIN')
ON CONFLICT ("role", "permissionId") DO NOTHING;
