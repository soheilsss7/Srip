# Changelog

All notable repository releases are recorded here.

## [Unreleased]

### Added
- Package 7 infrastructure/DR/performance/scalability/release verification gates.
- Concurrent bounded scalability benchmark with P50/P95/P99 evidence.
- Migration preflight requiring encrypted, checksum-verified backup evidence.
- Backup scheduler locking and post-backup integrity verification.

### Hardened
- API runtime Docker image uses a non-root user and liveness health check consistently across Docker entrypoints.

## Package 8 — Testing Matrix / Security Tests / E2E / Final Audit
- Added canonical Package 8 testing and final-audit matrix.
- Added executable security regression smoke covering OWASP categories and prompt-injection controls.
- Added canonical real-backend E2E flow including meeting completion, recommendation and permission denial.
- Added final static verification gate chaining Phase 39 and Package 7 verification.
- Preserved the distinction between repository/static evidence and environment-dependent production evidence.

## Package 8.1 — Pre-Test Backend Hardening

- Bounded Data Quality diagnostics and database-side coverage counts.
- Candidate narrowing for duplicate detection before similarity scoring.
- Batched import approval processing and paginated import reports.
- Authenticated object-storage readiness probe.
- Recursive sensitive-data sanitization for error tracking.
- CI gates for lint, dependency audit and integration tests.
- Repository security policy, dependency automation and license metadata.
\n## 2026-08-25 — Web Foundation: Role/Scope-Aware Executive Workspace\n- Added server-backed `/auth/me` identity/role/permission/scope contract.\n- Added shared Web Application Shell with permission-aware navigation and organization scope selector.\n- Added Executive/Governance dashboard using real Analytics and Reporting endpoints.\n- Preserved all existing Web routes and backend/mobile artifacts; no prior feature was removed.\nEOF

cat > docs/WEB_FRONTEND_8_16_EXTENSION.md <<'EOF'
# Web Frontend Extension on Package 8.16

## Baseline rule
Package 8.16 remains the canonical baseline. This extension does not delete or replace prior Web, Mobile, API, infrastructure, documentation, tests, or manifests.

## Architecture
The Web layer is now Role/Scope-aware:
- Identity is fetched from `GET /api/v1/auth/me`.
- Navigation is filtered by returned permissions.
- The active organization scope is a UI filter only; Backend authorization remains authoritative.
- The Executive/Governance Dashboard consumes real Analytics and Reporting endpoints.
- AI is not activated by this extension; the dashboard explicitly treats AI as a future/provider-dependent capability.

## Product rules preserved
- Relationship First
- Network First
- Actionable Intelligence
- Explainable AI
- Institutional Memory
- Cross-Company Intelligence
- Executive Simplicity

## Web coverage retained
Login, MFA, Dashboard, Organizations, Organization Profile, People, Person Profile, Relationships, Relationship Profile, Network, Meetings, Calendar, Actions, Commitments, Projects, Opportunities, Intelligence, Recommendations, Reports, Notifications, Search, Knowledge, Admin, Privacy/Data Requests, Data Import/Quality, Integrations, Documents and Analytics remain in the repository.

## Verification boundary
Static TypeScript/build verification is required before this extension is considered a new baseline. Runtime API/DB verification must use an environment with dependencies and PostgreSQL/Redis available; no fake runtime PASS is reported.

## 8.18.0 — Web Core UX Completion
- Added shared Page UI primitives.
- Added admin sub-workspaces for users, roles, permissions, tags, custom fields, scoring, notification rules, integrations and audit.
- Added data-quality and production import UI against the existing `/data/*` contract.
- Added privacy, sessions and settings workspaces.
- Upgraded reporting UI to consume real report endpoints.
- Preserved all prior files; no deletion.
