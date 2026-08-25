# Phase E — Data Lifecycle / Restore / Permanent Delete

This phase centralizes lifecycle operations without deleting prior backend implementations.

## Contract

- Every Prisma model carrying `deletedAt` is registered in `src/common/data-lifecycle/data-lifecycle.types.ts`.
- Soft delete writes `deletedAt` and `deletedById` and records `DataLifecycleRecord(DELETION)` plus `AuditAction.SOFT_DELETE`.
- Restore clears deletion markers, restores lifecycle/status where defined, records `RESTORED`, and audits the mutation.
- Permanent deletion is never exposed as a direct Prisma delete from a controller/domain service.
- Permanent deletion requires: `data.permanent_delete`, Super Admin, an approved `DataDeletionApproval`, and an audit record.
- A requester cannot approve their own permanent deletion.
- Active data-processing policy with `erasable=false` blocks permanent deletion.
- Retention execution uses the central lifecycle service rather than direct `deletedAt` updates.
- `DataLifecycleRecord` retains actor, approval and metadata context even after the entity itself is purged.

## API

- `POST /data-lifecycle/:entityType/:id/restore`
- `POST /data-lifecycle/:entityType/:id/permanent-delete` — creates/returns a pending approval request; it does not purge data immediately.
- `GET /data-lifecycle/approvals` — list pending approvals for Super Admins.
- `POST /data-lifecycle/approvals/:id/approve` — approves and executes the purge.
- `POST /data-lifecycle/approvals/:id/reject`
- `POST /relationships/:id/restore` — domain convenience endpoint using the same central service.

## Database

Migration: `prisma/migrations/20260824103000_phase_e_data_lifecycle/migration.sql`

Adds lifecycle states, governed deletion approval, audit actions, lifecycle actor/approval metadata, and missing `deletedById` fields on Referral and IntegrationConnection.
