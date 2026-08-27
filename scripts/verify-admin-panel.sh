#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
required=(
  "apps/api/src/admin/admin.controller.ts"
  "apps/api/src/admin/admin.service.ts"
  "apps/api/src/admin/admin.module.ts"
  "apps/api/prisma/migrations/20260128120000_admin_panel_backend_completion/migration.sql"
)
for f in "${required[@]}"; do test -f "$ROOT/$f" || { echo "MISSING:$f"; exit 1; }; done
for key in enterprise.admin admin.users admin.organizations admin.catalog admin.custom_fields admin.scoring_rules admin.notification_rules admin.ai_settings admin.integrations admin.audit; do
  grep -q "'$key'" "$ROOT/apps/api/prisma/seed.ts" || { echo "MISSING_PERMISSION:$key"; exit 1; }
done
for endpoint in "overview" "users" "organizations" "roles" "permissions" "tags" "relationship-types" "interaction-types" "workflows" "integrations" "audit" "custom-fields" "scoring-rules" "notification-rules" "ai-settings"; do
  grep -q "'$endpoint" "$ROOT/apps/api/src/admin/admin.controller.ts" || { echo "MISSING_ENDPOINT:$endpoint"; exit 1; }
done
echo "ADMIN_PANEL_STATIC_CHECK=PASS"
