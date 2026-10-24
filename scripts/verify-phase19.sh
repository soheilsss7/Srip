#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
required=(
  docs/PHASE_19_PRODUCTION_LAUNCH.md
  docs/PHASE_19_COMPLETION_RECONCILIATION.md
  docs/release/RELEASE_EVIDENCE_MANIFEST.md
  docs/release/RELEASE_MANIFEST_TEMPLATE.json
  docs/runbooks/PRODUCTION_GO_NO_GO.md
  scripts/preflight-phase19.sh
  docs/RELEASE_CHECKLIST.md
  docs/RELEASE_NOTES_TEMPLATE.md
  docs/runbooks/PRODUCTION_RELEASE.md
  docs/runbooks/PRODUCTION_ROLLBACK.md
  docs/runbooks/MOBILE_RELEASE.md
  scripts/backup-postgres.sh
  scripts/restore-postgres.sh
  docker-compose.production.yml
  .env.production.example
  scripts/verify-phase18.sh
)
for f in "${required[@]}"; do test -f "$root/$f" || { echo "MISSING: $f"; exit 1; }; done

grep -q "Production / Launch" "$root/docs/PHASE_19_PRODUCTION_LAUNCH.md"
grep -q "GO" "$root/docs/RELEASE_CHECKLIST.md"
grep -qi "rollback" "$root/docs/runbooks/PRODUCTION_RELEASE.md"
grep -q "Roll back" "$root/docs/runbooks/PRODUCTION_ROLLBACK.md" || grep -q "Rollback" "$root/docs/runbooks/PRODUCTION_ROLLBACK.md"
grep -q "TestFlight" "$root/docs/runbooks/MOBILE_RELEASE.md"
grep -q "Google Play" "$root/docs/runbooks/MOBILE_RELEASE.md"
grep -q "NO-GO" "$root/docs/runbooks/PRODUCTION_GO_NO_GO.md"
grep -q "PENDING" "$root/docs/release/RELEASE_EVIDENCE_MANIFEST.md"
bash "$root/scripts/preflight-phase19.sh" --static

echo "Phase 19 static production/launch verification OK"
