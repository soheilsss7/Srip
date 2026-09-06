# Phase 15 — Integrations

## Implemented
- Provider-neutral integration boundary for Google and Microsoft.
- Calendar and Email connection types.
- OAuth authorization state generation with hashed state and expiry.
- Tenant-aware connection ownership and optional organization scope.
- Connection lifecycle: PENDING / CONNECTED / ERROR / DISCONNECTED.
- Sync cursor persistence and last-success metadata.
- Server-side provider adapter boundary; no fake external HTTP success is claimed.
- Google and Microsoft authorization URL builders.
- Callback contract with state verification.
- Sync contract with explicit provider-unavailable failure until credentials and HTTP adapters are configured.
- HMAC-signed webhook boundary.
- Audit events for connection lifecycle changes.
- Web integrations workspace.
- Mobile integrations status/sync surface.
- Integration permissions: `integration.read`, `integration.write`.

## Runtime gates still required
- Configure Google/Microsoft OAuth credentials and redirect URIs.
- Implement and execute provider token exchange/refresh HTTP calls.
- Calendar event mapping into Meeting/Participant/Interaction domain records.
- Email thread/message ingestion and organization/person matching.
- Webhook subscription registration and renewal.
- Retry/backoff/idempotency worker execution.
- Conflict resolution and full sync reconciliation.
- PostgreSQL migration, API integration, browser/mobile E2E and external-provider tests.
