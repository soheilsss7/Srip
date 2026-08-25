# Phase 7 — Core Domain Implementation

## Baseline

This phase continues from `PHASE0_TO_PHASE6_COMPLETED_UNIFIED` without removing earlier work.

## Scope implemented in this increment

### Organization
- Authenticated organization directory with tenant-aware scope.
- Hierarchy-aware parent/child organization listing.
- Organization profile endpoint with people, children, relationships and counts.
- Create/update/archive flows.
- Owner assignment and duplicate-name protection within hierarchy scope.
- Soft-delete archive behavior.

### People
- Organization-scoped directory and search.
- Person profile endpoint with organization, recent interactions, meetings, actions and commitments.
- Create/update/archive flows.
- Duplicate protection by email or name within organization.
- Organization-scoped authorization on reads/writes.

### Relationships
- Relationship-first organization-to-organization directory.
- Relationship profile with owners, score snapshots, interactions, meetings and projects.
- Create/update/archive flows.
- Cross-organization authorization: the current principal must have write/read scope to both ends for protected relationship operations.
- Duplicate relationship protection.
- Sensitivity and score attributes exposed through validated DTOs.

### Web
- Organizations directory + create form.
- People directory/search + create form.
- Relationships directory + create form.
- Shared authenticated API client using the current access token.

### Scoring foundation
- Existing relationship score recalculation remains available.
- Latest interaction timestamp is now derived from the latest actual interaction rather than the recalculation time.

## Verification

- `scripts/verify-phase0-6.sh` — PASS (static)
- `scripts/verify-phase7.sh` — PASS (enhanced static)
- Organization/Person/Relationship profile + timeline routes are implemented.
- ContactInformation and OrganizationUnit persistence/API are implemented.
- Protected Core Domain mutations emit AuditLog records.
- Web profile routes and Mobile Organization/People directory screens are implemented.

## Environment-dependent gates

The following cannot be honestly marked PASS in this offline build environment because the repository has no installed dependencies and external package download is unavailable:

1. Prisma schema validation/generation with the installed Prisma CLI.
2. PostgreSQL migration + seed execution.
3. API integration tests.
4. Browser E2E.
5. Mobile device E2E.
6. Runtime tenant-isolation / IDOR tests.
7. Production deployment/observability checks.

These are explicit runtime gates, not missing source implementation.
