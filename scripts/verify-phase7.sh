#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
req=(
  "apps/api/src/organizations/organizations.controller.ts"
  "apps/api/src/organizations/organizations.service.ts"
  "apps/api/src/people/people.controller.ts"
  "apps/api/src/people/people.service.ts"
  "apps/api/src/relationships/relationships.controller.ts"
  "apps/api/src/relationships/relationships.service.ts"
  "apps/api/src/relationships/relationship-score.service.ts"
  "apps/web/app/organizations/page.tsx"
  "apps/web/app/people/page.tsx"
  "apps/web/app/relationships/page.tsx"
  "apps/web/app/_lib/api.ts"
)
for f in "${req[@]}"; do test -f "$root/$f" || { echo "Missing $f"; exit 1; }; done

grep -q "@Get(':id')" "$root/apps/api/src/organizations/organizations.controller.ts"
grep -q "@Patch(':id')" "$root/apps/api/src/organizations/organizations.controller.ts"
grep -q "@Patch(':id/archive')" "$root/apps/api/src/organizations/organizations.controller.ts"
grep -q "@Get(':id')" "$root/apps/api/src/people/people.controller.ts"
grep -q "@Patch(':id')" "$root/apps/api/src/people/people.controller.ts"
grep -q "@Patch(':id/archive')" "$root/apps/api/src/people/people.controller.ts"
grep -q "@Get(':id')" "$root/apps/api/src/relationships/relationships.controller.ts"
grep -q "@Patch(':id')" "$root/apps/api/src/relationships/relationships.controller.ts"
grep -q "@Patch(':id/archive')" "$root/apps/api/src/relationships/relationships.controller.ts"

grep -q "deletedAt: new Date()" "$root/apps/api/src/organizations/organizations.service.ts"
grep -q "deletedAt: new Date()" "$root/apps/api/src/people/people.service.ts"
grep -q "deletedAt: new Date()" "$root/apps/api/src/relationships/relationships.service.ts"
grep -q "assertPermission(userId, 'person.write'" "$root/apps/api/src/people/people.service.ts"
grep -q "assertPermission(userId, 'relationship.write'" "$root/apps/api/src/relationships/relationships.service.ts"
grep -q "relationshipScoreSnapshot" "$root/apps/api/src/relationships/relationship-score.service.ts"

echo "PHASE 7 STATIC VERIFICATION OK"

grep -q "timeline" "$root/apps/api/src/organizations/organizations.controller.ts"
grep -q "timeline" "$root/apps/api/src/people/people.controller.ts"
grep -q "timeline" "$root/apps/api/src/relationships/relationships.controller.ts"
grep -q "ContactInformation" "$root/apps/api/prisma/schema.prisma"
grep -q "OrganizationUnit" "$root/apps/api/prisma/schema.prisma"
grep -q "strategicImportance" "$root/apps/api/prisma/schema.prisma"
grep -q "nextActionAt" "$root/apps/api/prisma/schema.prisma"
grep -q "logMutation" "$root/apps/api/src/organizations/organizations.service.ts"
grep -q "logMutation" "$root/apps/api/src/people/people.service.ts"
grep -q "logMutation" "$root/apps/api/src/relationships/relationships.service.ts"
test -f "$root/apps/web/app/organizations/[id]/page.tsx"
test -f "$root/apps/web/app/people/[id]/page.tsx"
test -f "$root/apps/web/app/relationships/[id]/page.tsx"
test -f "$root/apps/mobile/src/app/organizations.tsx"
test -f "$root/apps/mobile/src/app/people.tsx"

echo "PHASE 7 ENHANCED STATIC VERIFICATION OK"
