#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
test -f "$ROOT/apps/web/app/_components/operational-table.tsx"
test -f "$ROOT/apps/web/app/admin/page.tsx"
test -f "$ROOT/apps/web/app/calendar/page.tsx"
test -f "$ROOT/apps/web/app/knowledge/page.tsx"
test -f "$ROOT/apps/web/app/mfa/page.tsx"
test -f "$ROOT/apps/web/app/forgot-password/page.tsx"
test -f "$ROOT/apps/web/app/intelligence/page.tsx"
test -f "$ROOT/apps/web/app/reports/page.tsx"
test -f "$ROOT/apps/web/app/recommendations/page.tsx"
grep -q "Badge" "$ROOT/apps/web/app/approvals/page.tsx"
echo "PACKAGE 8.22 STATIC FRONTEND AUDIT: PASS"
