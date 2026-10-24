# PHASE 1 — Core Domain Completion

Baseline: `srip-starter-2_PHASEAR_RECONCILIATION_FREEZE_BASELINE.zip`

Scope: Backend only. Frontend and AI were intentionally not changed.

## Completed

### Organization
- Preserved existing Organization/Holding/Subsidiary model and hierarchy.
- Fixed controller pagination so `page` and `pageSize` reach the service.
- Added validated create/update DTO boundaries for URL/email/score fields.
- Added Restore endpoint and transactional restore + domain event path.
- Preserved existing soft-delete, audit and transactional outbox behavior.

### Person
- Preserved existing primary `organizationId` contract.
- Added `OrganizationPerson` affiliation model without removing the existing primary organization relation.
- Person creation now creates a primary affiliation in the same transaction.
- Organization changes reconcile primary affiliation in the same transaction.
- Added list/add/remove organization affiliation APIs.
- Added Restore endpoint.
- Added deterministic duplicate checks for email or first+last name within organization.
- Added DTO response boundary for Person responses.

### Relationship
- Preserved the existing Organization-to-Organization Relationship architecture.
- Fixed organization filtering so a requested organization matches either source or target instead of requiring both to be the same organization.
- Added update allowlist so persistence/security fields cannot be mass-assigned.
- Enforced source != target on update as well as create.
- Validated owner/backup-owner scope through AuthorizationService.
- Added missing `engagementScore` to the create contract.
- Added transactional restore + event path.
- Preserved score/lifecycle/status event behavior and Approval hooks.

### Data Lifecycle
- Extended `restore()` with an optional Prisma transaction client so restore + audit + lifecycle record can participate in the same transaction as the domain event/outbox.

## Verification
- Structural Phase 1 verification: PASS.
- TypeScript syntax parsing of all changed TypeScript files: PASS.
- Full npm/Prisma/Jest execution could not be performed in this sandbox because the repository has no installed `node_modules` and package installation timed out; therefore no false claim of a full runtime test is made.

## No deletions
No previous Phase implementation was intentionally removed. Existing architecture was reconciled and completed.
