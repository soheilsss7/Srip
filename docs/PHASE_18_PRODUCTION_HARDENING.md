# Phase 18 — Production Hardening

Date: 2026-08-23

## Scope
Phase 18 adds the repository-level production hardening foundation required by the master technical specification: deployment artifacts, environment separation, health/readiness/liveness, metrics, dashboards, persistent production service definitions, and backup/restore runbooks.

## Implemented
- Production Dockerfiles for API and Web with health checks.
- `docker-compose.production.yml` with PostgreSQL, Redis, API, Web, Prometheus and Grafana.
- Production environment template with secrets explicitly externalized.
- API request metrics at `/api/v1/metrics` plus a JSON summary endpoint.
- Prometheus scrape configuration and a minimal Grafana dashboard.
- PostgreSQL custom-format encrypted backup/restore scripts.
- Daily backup scheduler with configurable retention.
- PostgreSQL physical base backup + continuous WAL archive foundation for PITR.
- S3-compatible encrypted backup/WAL transport and lifecycle policy.
- Automated isolated restore drill, backup integrity verification and RPO/RTO evidence tooling.
- Production hardening documentation and explicit verification semantics.

## Still required before production
- Real staging deployment with managed PostgreSQL/Redis/object storage.
- TLS termination, DNS, WAF and external rate limiting.
- Secret-manager integration and key rotation.
- Real alert rules/on-call routing.
- Distributed tracing and centralized structured log retention.
- Production evidence still required: execute the backup schedule, restore drill, RPO/RTO measurement and disaster-recovery exercise against the real managed PostgreSQL and backup store.
- Database migration rehearsal and rollback/compatibility verification.
- Load test, autoscaling and capacity validation.
- Security/pentest remediation and production UAT.
- Production mobile signing/store release gates.

## Verification semantics
`check:phase18` is a static artifact/contract gate. A green result does not mean a production cloud, managed database, DNS, TLS, WAF, backup repository, monitoring alert, or disaster-recovery environment was actually exercised.
