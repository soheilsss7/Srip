#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

psql_cmd=(psql "$RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1)

# Schema existence: these are stable core/domain tables from schema.prisma.
required_tables=(
  organization person relationship interaction meeting action commitment
  project opportunity audit_log domain_event_outbox workflow_execution
  approval_request notification analytics_event feature_flag
)

missing=()
for table in "${required_tables[@]}"; do
  exists="$("${psql_cmd[@]}" -Atqc "SELECT to_regclass('public.$table') IS NOT NULL;")"
  [[ "$exists" == "t" ]] || missing+=("$table")
done
if ((${#missing[@]})); then
  printf 'RESTORE_VERIFY_FAILED missing_tables=%s\n' "${missing[*]}" >&2
  exit 1
fi

# A restored PostgreSQL database must have no unvalidated constraints.
unvalidated="$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM pg_constraint WHERE convalidated = false;")"
[[ "$unvalidated" == "0" ]] || { echo "RESTORE_VERIFY_FAILED unvalidated_constraints=$unvalidated" >&2; exit 1; }

# Verify that all expected application tables are queryable and produce numeric counts.
for table in "${required_tables[@]}"; do
  count="$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM public.$table;")"
  [[ "$count" =~ ^[0-9]+$ ]] || { echo "RESTORE_VERIFY_FAILED invalid_count:$table" >&2; exit 1; }
done

# Verify migrations table exists when Prisma migrations are part of the deployed database.
migration_table="$("${psql_cmd[@]}" -Atqc "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;")"
if [[ "$migration_table" == "t" ]]; then
  failed_migrations="$("${psql_cmd[@]}" -Atqc "SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;")"
  [[ "$failed_migrations" == "0" ]] || { echo "RESTORE_VERIFY_FAILED incomplete_prisma_migrations=$failed_migrations" >&2; exit 1; }
fi

printf 'RESTORE_VERIFY=PASS\n'
printf 'RESTORE_VERIFY_TABLES=%s\n' "${#required_tables[@]}"
printf 'RESTORE_VERIFY_UNVALIDATED_CONSTRAINTS=0\n'
