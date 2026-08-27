#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; API="$ROOT/apps/api"; SCHEMA="$API/prisma/schema.prisma"; MIG="$API/prisma/migrations/20260203120000_phaseD_custom_fields/migration.sql"
fail(){ echo "[FAIL] $1" >&2; exit 1; }; pass(){ echo "[PASS] $1"; }
grep -q 'model CustomFieldValue' "$SCHEMA" || fail 'CustomFieldValue model missing'
for x in 'stringValue String?' 'numberValue Decimal?' 'booleanValue Boolean?' 'dateValue DateTime?' 'jsonValue Json?' '@@unique([customFieldId, entityType, entityId])'; do grep -Fq "$x" "$SCHEMA" || fail "Schema contract missing: $x"; done
for x in 'CustomFieldValue_exactly_one_value_ck' 'CustomField_global_entityType_key_key' 'FOREIGN KEY ("customFieldId")'; do grep -Fq "$x" "$MIG" || fail "Migration contract missing: $x"; done
for x in 'CUSTOM_FIELD_CREATED' 'CUSTOM_FIELD_UPDATED' 'CUSTOM_FIELD_DELETED' 'CUSTOM_FIELD_VALUE_SET' 'CUSTOM_FIELD_VALUE_REMOVED'; do grep -Fq "$x" "$SCHEMA" || fail "Audit action missing: $x"; done
[ -f "$API/src/custom-fields/custom-fields.controller.ts" ] || fail 'CustomFieldsController missing'; [ -f "$API/src/custom-fields/custom-fields.service.ts" ] || fail 'CustomFieldsService missing'; [ -f "$API/test/unit/custom-fields.contract.spec.ts" ] || fail 'Contract test missing'; [ -f "$API/test/unit/custom-fields.schema.spec.ts" ] || fail 'Schema test missing'
pass 'Phase D Custom Fields backend contract verified'
