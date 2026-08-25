#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE="$ROOT/src/analytics/analytics.service.ts"
LISTENER="$ROOT/src/analytics/analytics-recommendation.listener.ts"
CONTROLLER="$ROOT/src/analytics/analytics.controller.ts"
CONSTANTS="$ROOT/src/event-bus/event-bus.constants.ts"
SCHEMA="$ROOT/prisma/schema.prisma"
MIGRATION="$ROOT/prisma/migrations/20260824130000_phase_y_recommendation_funnel/migration.sql"
for f in "$SERVICE" "$LISTENER" "$CONTROLLER" "$CONSTANTS" "$SCHEMA" "$MIGRATION"; do test -f "$f"; done
for token in RECOMMENDATION_VIEWED RECOMMENDATION_ACCEPTED RECOMMENDATION_ACTION_CREATED RECOMMENDATION_ACTION_COMPLETED RECOMMENDATION_OUTCOME; do grep -q "$token" "$CONSTANTS" "$SERVICE" "$LISTENER"; done
grep -q "recommendationFunnel" "$SERVICE" "$CONTROLLER"
grep -q "feature.*recommendation_funnel" "$LISTENER" "$SERVICE"
grep -q 'COUNT(DISTINCT' "$SERVICE"
grep -q 'AnalyticsEvent_metadata_gin_idx' "$MIGRATION"
grep -q 'model AnalyticsEvent' "$SCHEMA"
echo "PHASE_Y_ANALYTICS_CONTRACT=PASS"
