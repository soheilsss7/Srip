#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
test -f "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
test -f "$ROOT/apps/api/src/ai/ai.controller.ts"
test -f "$ROOT/apps/api/src/ai/ai.module.ts"
grep -q "permissionAwareRetrieval:true" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "AuditAction.READ" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "MEETING_BRIEF" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "ACTION_EXTRACTION" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "RISK_DETECTION" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "OPPORTUNITY_DETECTION" "$ROOT/apps/api/src/ai/ai.gateway.service.ts"
grep -q "^# Phase 12" "$ROOT/docs/phases/PHASE12_AI.md"
echo "PHASE 12 STATIC VERIFICATION OK"
