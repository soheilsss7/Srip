#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="$ROOT/apps/api/prisma/schema.prisma"
MIGRATION="$ROOT/apps/api/prisma/migrations/20260123120000_phaseC_tag_system/migration.sql"
CONTROLLER="$ROOT/apps/api/src/tags/tags.controller.ts"
SERVICE="$ROOT/apps/api/src/tags/tags.service.ts"
MODULE="$ROOT/apps/api/src/tags/tags.module.ts"

grep -q "model TagAssignment" "$SCHEMA"
grep -q "@@unique(\[tagId, entityType, entityId\])" "$SCHEMA"
grep -q "assignments TagAssignment\[\]" "$SCHEMA"
grep -q "tagAssignments TagAssignment\[\]" "$SCHEMA"
for a in TAG_CREATED TAG_UPDATED TAG_ASSIGNED TAG_REMOVED; do grep -q "$a" "$SCHEMA"; done
for route in "@Post('tags')" "@Get('tags')" "@Patch('tags/:id')" "@Delete('tags/:id')" "@Get('entities/:entityType/:entityId/tags')" "@Post('entities/:entityType/:entityId/tags')" "@Delete('entities/:entityType/:entityId/tags/:tagId')"; do grep -Fq "$route" "$CONTROLLER"; done
grep -q "'entity.read'" "$SERVICE"
grep -q "'entity.write'" "$SERVICE"
for a in TAG_CREATED TAG_UPDATED TAG_ASSIGNED TAG_REMOVED; do grep -q "$a" "$SERVICE"; done
grep -q "TagAssignment_tagId_entityType_entityId_key" "$MIGRATION"
grep -q "TagAssignment_tagId_fkey" "$MIGRATION"
grep -q "TagAssignment_organizationId_fkey" "$MIGRATION"
grep -q "TagAssignment_createdById_fkey" "$MIGRATION"
grep -q "TagsModule" "$ROOT/apps/api/src/app.module.ts"
grep -q "TagsModule" "$MODULE"
echo "[PASS] Phase C Tag System static contract verification passed."
