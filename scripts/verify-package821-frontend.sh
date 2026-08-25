#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-apps/web}"
test -d "$ROOT/app"
test -f "$ROOT/app/_components/workspace.tsx"
test -f "$ROOT/app/_components/crud-workspace.tsx"
test -f "$ROOT/app/dashboard/page.tsx"
test -f "$ROOT/app/search/page.tsx"
for p in actions commitments projects opportunities; do test -f "$ROOT/app/$p/page.tsx"; done
grep -q "useEffect" "$ROOT/app/search/page.tsx"
grep -q "from 'react'" "$ROOT/app/search/page.tsx"
echo "frontend static route audit: PASS"
