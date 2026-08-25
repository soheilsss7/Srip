#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
fail(){ echo "FAIL: $1" >&2; exit 1; }
[ -f "$API/src/reporting/reporting.service.ts" ] || fail "reporting service missing"
[ -f "$API/src/reporting/reporting.controller.ts" ] || fail "reporting controller missing"
[ -f "$API/src/reporting/reporting.module.ts" ] || fail "reporting module missing"
[ -f "$API/prisma/migrations/20260824_reporting_export_engine/migration.sql" ] || fail "reporting migration missing"
for kind in relationship-health relationship-risk network meeting opportunity project company executive holding executive-summary; do grep -q "'$kind'" "$API/src/reporting/reporting.service.ts" || fail "report kind missing: $kind"; done
for fmt in csv xlsx pdf json; do grep -q "'$fmt'" "$API/src/reporting/reporting.service.ts" || fail "export format missing: $fmt"; done
grep -q "report.read" "$API/src/common/authorization/access.constants.ts" || fail "report.read permission missing"
grep -q "report.export" "$API/src/common/authorization/access.constants.ts" || fail "report.export permission missing"
grep -q "dataExportLog" "$API/src/reporting/reporting.service.ts" || fail "export audit log missing"
grep -q "action:'EXPORT'" "$API/src/reporting/reporting.service.ts" || fail "audit EXPORT event missing"
grep -q "ReportingModule" "$API/src/app.module.ts" || fail "ReportingModule not mounted"
grep -q "summary:{" "$API/src/reporting/reporting.service.ts" || fail "executive summary summary missing"
grep -q "kpi:{" "$API/src/reporting/reporting.service.ts" || fail "executive summary KPI missing"
grep -q "trends:{" "$API/src/reporting/reporting.service.ts" || fail "executive summary trends missing"
grep -q "risks:" "$API/src/reporting/reporting.service.ts" || fail "executive summary risks missing"
grep -q "opportunities:" "$API/src/reporting/reporting.service.ts" || fail "executive summary opportunities missing"
grep -q "recommendations:" "$API/src/reporting/reporting.service.ts" || fail "executive summary recommendations missing"
grep -q "supportingData:" "$API/src/reporting/reporting.service.ts" || fail "executive summary supporting data missing"
grep -q "relationshipHealth" "$API/src/reporting/reporting.service.ts" || fail "relationship health report missing"
grep -q "riskScore" "$API/src/reporting/reporting.service.ts" || fail "relationship risk data missing"
grep -q "networkReport" "$API/src/reporting/reporting.service.ts" || fail "network report implementation missing"
grep -q "meetingRows" "$API/src/reporting/reporting.service.ts" || fail "meeting report implementation missing"
grep -q "opportunityRows" "$API/src/reporting/reporting.service.ts" || fail "opportunity report implementation missing"
grep -q "projectRows" "$API/src/reporting/reporting.service.ts" || fail "project report implementation missing"
grep -q "companyRows" "$API/src/reporting/reporting.service.ts" || fail "company report implementation missing"
grep -q "executiveRows" "$API/src/reporting/reporting.service.ts" || fail "executive report implementation missing"
grep -q "holdingReport" "$API/src/reporting/reporting.service.ts" || fail "holding report implementation missing"
grep -q "Executive Report" "$ROOT/docs/PHASE27_REPORTING_EXPORT_COMPLETION.md" || fail "completion doc missing"
# Basic TypeScript parser check: tsc must report only dependency-resolution failures in this dependency-free sandbox.
if command -v tsc >/dev/null 2>&1; then
  OUT=$(cd "$API" && tsc --noEmit --noResolve --target ES2023 --module commonjs --experimentalDecorators --emitDecoratorMetadata --esModuleInterop --skipLibCheck src/reporting/reporting.service.ts src/reporting/reporting.controller.ts src/reporting/reporting.module.ts 2>&1 || true)
  if echo "$OUT" | grep -E "error TS1(00[0-9]|1[0-9][0-9])|error TS2[0-9]{3}" | grep -v "TS2307" | grep -v "TS2580" >/dev/null; then
    echo "$OUT"; fail "unexpected TypeScript syntax/type diagnostic in reporting files"
  fi
fi
echo "PASS: Reporting / Export structural verification"
