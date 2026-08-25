# Phase 32 — Calendar / Email / Google / Microsoft Integration Reconciliation

This phase closes the backend integration gaps against MASTER_TECHNICAL_SPEC sections 125–127 and the integration requirements in section 126.

## Email
- OAuth with Gmail/Outlook minimal read scopes.
- Gmail message metadata includes subject/from/to/date and real Gmail threadId.
- Microsoft Graph uses conversationId as the thread mapping key.
- External messages are persisted idempotently by connection/provider resource/external ID.
- Email messages are reconciled into Interaction records with person/organization/relationship links when matching succeeds.

## Calendar
- Google Calendar and Microsoft Calendar OAuth/sync.
- Google `showDeleted=true` and Microsoft Graph delta are used for cancellation/update reconciliation.
- External event identity, updated timestamp and ETag are persisted.
- Events map to Meeting records and MeetingParticipant records through person email matching.
- Meeting updates mutate the existing Meeting rather than creating duplicates.
- Cancellation archives the canonical Meeting and marks the external record cancelled.
- Organization and organization-to-organization Relationship links are resolved from matched participants.

## Google Workspace
- Gmail
- Calendar
- Drive read synchronization

## Microsoft 365 / Graph
- Outlook Mail
- Calendar
- Teams online meetings
- SharePoint sites
- OAuth scopes are resource-specific.

## Token lifecycle
- Access-token expiry is checked before sync.
- Refresh tokens are used when available.
- Refreshed credentials are persisted.

## Observability
- IntegrationSyncRun records each sync attempt and reconciliation counts/errors.
- Sync cursor is retained for incremental provider synchronization.

## Security
- Existing OAuth state validation is preserved.
- Integration secrets/tokens are never returned by the connection list API.
- Organization scope is preserved for connection creation and reconciliation.
