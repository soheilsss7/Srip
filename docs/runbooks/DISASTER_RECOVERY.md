# Disaster Recovery / Backup & Restore Runbook

Source alignment: technical specification sections 90–92, Business Continuity section 149, and Production Hardening / Launch requirements.

## 1. Objectives

The repository implements this mandatory chain:

```text
Backup
  ↓
Integrity Check
  ↓
Restore
  ↓
Verification
  ↓
Disaster Recovery Drill
  ↓
Evidence
```

The specification lists `RPO <= 15 min` and `RTO <= 1 hour` as examples and explicitly requires final values to be determined after needs assessment. Repository defaults remain provisional.

- RPO target: 15 minutes (provisional)
- RTO target: 60 minutes (provisional)
- Backup retention: 35 days (configurable)
- Daily encrypted logical backup: enabled by `backup` service
- PITR base backup: daily, encrypted
- WAL archive: continuous, `archive_timeout=60s`
- Cross-region: supported by configuring a second S3-compatible bucket/replication policy

## 2. Backup Chain

1. Daily encrypted `pg_dump` for logical recovery.
2. Daily encrypted `pg_basebackup` for physical/PITR recovery.
3. PostgreSQL WAL continuously archived to the backup object store.
4. SHA-256 checksums are written beside backup artifacts.
5. A JSON manifest can be generated for each artifact.
6. S3 lifecycle policy enforces retention.

## 3. Integrity Check

Run before any restore:

```bash
BACKUP_ENCRYPTION_KEY=... ./scripts/verify-backup-integrity.sh ./backups/srip-....dump.enc
```

The check must pass:

- file exists
- checksum file exists
- SHA-256 matches
- encrypted payload decrypts
- PostgreSQL custom dump can be inspected with `pg_restore --list`

For a manifest:

```bash
./scripts/create-backup-manifest.sh ./backups/srip-....dump.enc
```

A checksum match alone is not considered a successful restore.

## 4. Logical Restore

Never overwrite production during a drill.

```bash
BACKUP_ENCRYPTION_KEY=... \
DATABASE_URL=... \
./scripts/restore-postgres.sh ./backups/srip-....dump.enc
```

For an isolated test, use `restore-drill.sh` instead.

## 5. Restore Verification

After restore:

```bash
RESTORE_DATABASE_URL=... ./scripts/verify-restore.sh
```

Verification checks:

- core/domain tables exist
- all expected core tables are queryable
- no unvalidated PostgreSQL constraints remain
- Prisma migration state has no unfinished migration when `_prisma_migrations` exists
- row counts are valid
- restore target is not production

## 6. Restore Drill

Run against an isolated database:

```bash
DRILL_ADMIN_DATABASE_URL=... \
BACKUP_ENCRYPTION_KEY=... \
./scripts/restore-drill.sh ./backups/srip-....dump.enc
```

The drill performs:

```text
Checksum
 ↓
Decrypt
 ↓
pg_restore list
 ↓
Create isolated DB
 ↓
Restore
 ↓
Schema verification
 ↓
Constraint verification
 ↓
Application-table verification
 ↓
Measure restore duration
 ↓
Evidence JSON
```

## 7. PITR Drill

Prepare an isolated PITR data directory:

```bash
BACKUP_ENCRYPTION_KEY=... \
PITR_TARGET_TIME=2026-08-24T07:30:00Z \
PITR_WAL_SOURCE=s3://bucket/srip/wal \
./scripts/restore-pitr.sh ./backups/pitr-base-....tar.gz.enc ./pitr-restore-data
```

Start the isolated PostgreSQL instance, wait for the recovery target, then verify:

- recovery reached the requested target
- database opens read/write after promotion
- core tables exist
- application integrity checks pass
- measured recovery duration is recorded

## 8. Technical Disaster Drill

A technical drill must use a non-production restore target.

```bash
DRILL_ADMIN_DATABASE_URL=... \
BACKUP_ENCRYPTION_KEY=... \
./scripts/disaster-drill.sh ./backups/srip-....dump.enc
```

For an environment-specific non-production cutover/failover command:

```bash
DRILL_CUTOVER_COMMAND='...' ./scripts/disaster-drill.sh ./backups/srip-....dump.enc
```

The command is deliberately explicit; the repository must never guess or execute a production cutover automatically.

The drill should cover:

- simulated database loss/failure
- backup-store access
- latest verified backup selection
- PITR target selection
- restore
- application verification
- queue/Redis recovery assessment
- failover/cutover in the isolated environment
- integrity checks
- communication plan
- return/rollback to service
- RPO/RTO evidence

## 9. RPO Measurement

```bash
./scripts/measure-rpo.sh ./backups/srip-....dump.enc 2026-08-24T08:00:00Z
```

The result is measured evidence, not a claimed SLA.

## 10. Evidence Gate

Production readiness requires attaching:

- backup schedule evidence
- successful checksum evidence
- successful decryption evidence
- WAL/PITR evidence
- retention policy evidence
- restore verification evidence
- measured restore RTO
- measured RPO
- disaster drill report
- owner/date/incident ticket
- remediation actions and re-test evidence

A script existing in Git is **not** evidence that production recovery has been tested.

## 11. Safety Rules

- Never run a restore drill against the production database.
- Never store backup encryption keys in Git.
- Never report RPO/RTO as PASS without measured evidence.
- Never declare a DR drill complete from a generated template alone.
- Any production cutover must require an explicit human-controlled deployment/incident process.
