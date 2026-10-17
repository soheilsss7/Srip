#!/usr/bin/env bash
set -euo pipefail

: "${RPO_TARGET_MINUTES:=15}"
: "${RTO_TARGET_MINUTES:=60}"
: "${DR_DRILL_EVIDENCE_FILE:=./backups/disaster-drill-$(date -u +%Y%m%dT%H%M%SZ).json}"

backup="${1:-}"
started="$(date +%s)"
restore_status="not-run"
restore_evidence=""

if [[ -n "$backup" ]]; then
  test -f "$backup" || { echo "Backup not found: $backup" >&2; exit 1; }
  : "${DRILL_ADMIN_DATABASE_URL:?DRILL_ADMIN_DATABASE_URL is required when a backup is supplied}"
  : "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required when a backup is supplied}"
  restore_evidence="./backups/restore-drill-$(date -u +%Y%m%dT%H%M%SZ).json"
  DRILL_EVIDENCE_FILE="$restore_evidence" ./scripts/restore-drill.sh "$backup"
  restore_status="passed"
fi

cutover_status="not-run"
if [[ -n "${DRILL_CUTOVER_COMMAND:-}" ]]; then
  echo "Executing declared non-production drill cutover command..."
  bash -c "$DRILL_CUTOVER_COMMAND"
  cutover_status="passed"
fi

ended="$(date +%s)"
elapsed=$((ended-started))
mkdir -p "$(dirname "$DR_DRILL_EVIDENCE_FILE")"
cat > "$DR_DRILL_EVIDENCE_FILE" <<JSON
{
  "exercise": "SRIP disaster recovery technical drill",
  "executed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "rpo_target_minutes": $RPO_TARGET_MINUTES,
  "rto_target_minutes": $RTO_TARGET_MINUTES,
  "elapsed_seconds": $elapsed,
  "restore_drill_executed": $( [[ "$restore_status" == "passed" ]] && echo true || echo false ),
  "restore_status": "$restore_status",
  "cutover_status": "$cutover_status",
  "restore_evidence": "$restore_evidence",
  "runbook": "docs/runbooks/DISASTER_RECOVERY.md"
}
JSON

if [[ "$restore_status" == "passed" ]]; then
  echo "DISASTER_DRILL_RESTORE=PASS"
else
  echo "DISASTER_DRILL_RESTORE=NOT_RUN"
fi
echo "Disaster drill evidence written to $DR_DRILL_EVIDENCE_FILE"
