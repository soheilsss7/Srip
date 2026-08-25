#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/apps/api"

fail() {
  echo "[FAIL] $1" >&2
  exit 1
}

need_dir() {
  [[ -d "$1" ]] || fail "Missing directory: $1"
}

need_file() {
  [[ -f "$1" ]] || fail "Missing file: $1"
}

# Phase A: backend structure contract
for d in \
  "$API/prisma" \
  "$API/src/auth" \
  "$API/src/authorization" \
  "$API/src/common" \
  "$API/src/organizations" \
  "$API/src/people" \
  "$API/src/relationships" \
  "$API/src/interactions" \
  "$API/src/meetings" \
  "$API/src/actions" \
  "$API/src/commitments" \
  "$API/src/projects" \
  "$API/src/opportunities" \
  "$API/src/requirements" \
  "$API/src/network" \
  "$API/src/scoring" \
  "$API/src/workflows" \
  "$API/src/notifications" \
  "$API/src/integrations" \
  "$API/src/audit" \
  "$API/src/analytics" \
  "$API/src/data-management"
do
  need_dir "$d"
done

need_file "$API/prisma/schema.prisma"

# Phase B.1: relationship/tag database contract
SCHEMA="$API/prisma/schema.prisma"
grep -q '^model RelationshipTag {' "$SCHEMA" || fail "RelationshipTag model missing"
grep -q 'tags RelationshipTag\[\]' "$SCHEMA" || fail "Relationship.tags relation missing"
grep -q 'relationships RelationshipTag\[\]' "$SCHEMA" || fail "Tag.relationships relation missing"
grep -q '@@id(\[relationshipId, tagId\])' "$SCHEMA" || fail "RelationshipTag composite key missing"
grep -q 'relationship Relationship @relation(fields: \[relationshipId\], references: \[id\], onDelete: Cascade)' "$SCHEMA" || fail "RelationshipTag relationship FK missing"
grep -q 'tag Tag @relation(fields: \[tagId\], references: \[id\], onDelete: Cascade)' "$SCHEMA" || fail "RelationshipTag tag FK missing"

# Existing migration history must remain intact.
MIGRATIONS="$API/prisma/migrations"
need_dir "$MIGRATIONS"
find "$MIGRATIONS" -mindepth 1 -maxdepth 1 -type d | grep -q . || fail "Prisma migration history is missing"

echo "[PASS] Phase A backend structure and contract freeze checks passed."
echo "[PASS] Phase B.1 RelationshipTag schema contract checks passed."
