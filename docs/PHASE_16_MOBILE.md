# Phase 16 — Mobile

## Scope

Phase 16 turns the existing Expo/React Native shell into an authenticated, domain-driven mobile client without duplicating server authorization.

## Implemented

- Expo Router application shell and authenticated route switching.
- Secure access-token persistence using `expo-secure-store`.
- Login/logout against the existing `/auth/login` and `/auth/logout` API.
- Shared authenticated API client with JSON/error handling.
- Tab navigation for Home, Relationships, Meetings, Actions and More.
- Relationship, meeting and action list screens backed by live API endpoints.
- Meeting and relationship detail routes.
- Notification list surface.
- Loading, empty, error and pull-to-refresh states.
- Central mobile UI tokens/styles.
- Mobile feature documentation.

## Security boundary

Authorization remains server-side. The mobile client only supplies the bearer token and renders responses; it does not decide organization or permission scope.

## Remaining runtime gates

- Install dependencies and run Expo typecheck/export.
- Execute against a running API and PostgreSQL environment.
- Add device/browser E2E tests.
- Add offline queue and conflict resolution.
- Add push notifications and deep-link handling.
- Add richer create/edit forms for each domain.
- Add Network, Intelligence and AI mobile workflows.
- Validate secure storage, logout revocation and session refresh on physical devices.
