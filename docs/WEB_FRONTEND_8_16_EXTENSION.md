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
Static source-level reconciliation was performed. Dependency installation did not complete within the execution window, so a real Next.js build or live API/DB verification is not falsely claimed as PASS. The next environment with installed dependencies must run `pnpm --filter @srip/web typecheck`, `pnpm --filter @srip/web build`, and the API unit/integration gates before this artifact is treated as runtime-verified.
