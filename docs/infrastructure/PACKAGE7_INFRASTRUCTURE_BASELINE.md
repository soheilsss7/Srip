# Package 7 — Infrastructure / Backup / DR / Performance / Scalability / Release

This package is the canonical continuation of Package 6.

## Contract
- Production API/Web containers are multi-stage, non-root, and health-checked.
- Environments remain separated by database, credentials, secrets, and storage configuration.
- PostgreSQL uses versioned Prisma migrations; risky migrations require a verified backup before deployment.
- Logical encrypted backups and physical/PITR base backups are scheduled, checksummed, manifested, retention-managed, and integrity-verified.
- WAL is archived for PITR; RPO/RTO are targets until measured against real infrastructure.
- Restore drills are isolated and produce evidence; production readiness is never inferred from static checks.
- Performance evidence records P50/P95/P99. Source targets are API P95 <500ms and Search P95 <1s under normal conditions; thresholds must be revalidated against real data volume.
- Scalability tests keep graph/search/report queries bounded and server-side.
- Release identity requires Semantic Versioning, Changelog, Release Notes, staging validation, production approval, and rollback evidence.
- External CDN/WAF/load-balancer/DNS/TLS/provider controls remain deployment evidence gates, not claims of local execution.

## Repository changes
- Hardened `apps/api/Dockerfile` to match the production non-root/health-check contract.
- Hardened `scripts/backup-scheduler.sh` with an exclusive lock, manifests, and immediate integrity verification.
- Added `scripts/migration-preflight.sh`.
- Added `tests/load/scalability-concurrency.mjs`.
- Added `scripts/performance-gate.sh`.
- Added `scripts/release/validate-release-identity.sh` and `CHANGELOG.md`.

## Runtime evidence boundary
Static verification can prove repository contracts and script syntax. It cannot prove real RPO/RTO, cloud failover, WAF/DNS/TLS, or load targets without the intended staging/production services and data volumes.
