# Phase 3 — Database & ERD Foundation

## Scope

Phase 3 implements the database/ERD foundation defined by the phased execution document and the technical checklist. It is intentionally limited to the persistence layer and does not claim completion of Authentication, Authorization, Core Domain API, Search, Workflow execution, or UI phases.

## Domain coverage

The Prisma schema contains the database entities required by the current technical specification:

- Identity: `User`, `Membership`, `Session`, `LoginHistory`, `PasswordResetToken`, `EmailVerificationToken`
- Organization / people: `Organization`, `Person`
- Relationship intelligence: `Relationship`, `RelationshipScoreSnapshot`
- Engagement: `Interaction`, `Meeting`, `MeetingParticipant`, `Action`, `Commitment`
- Delivery / commercial: `Project`, `ProjectRelationship`, `Requirement`, `Opportunity`
- Knowledge / communication: `Note`, `Document`, `Tag`, `Notification`, `Recommendation`
- Governance: `AuditLog`, `Permission`, `RolePermission`
- Automation foundation: `Workflow`, `WorkflowExecution`

## Phase 3 database hardening

### Foreign keys and ownership integrity

Previously scalar-only ownership/creator IDs are now explicit Prisma relations and PostgreSQL foreign keys for:

- Relationship owner and backup owner
- Project owner
- Note creator
- Document creator
- Audit organization scope
- Workflow organization scope

### Soft delete

Important mutable entities now have both `deletedAt` and `deletedById` with a foreign key to `User`. The migration also adds indexes on `deletedAt` so application queries can efficiently enforce the active-row convention (`deletedAt IS NULL`).

Soft delete is a database capability in this phase. Restore/permanent-delete service authorization belongs to the later Authorization/Core Domain phases and is therefore not falsely marked complete here.

### Tenant / organization scope

Organization-owned entities already carry organization foreign keys where their ownership is direct. Phase 3 additionally anchors `AuditLog` and `Workflow` to an organization. Relationship records remain bounded by their source/target organizations. Application-level cross-tenant authorization remains a later Phase 5 responsibility.

### Audit governance

`AuditLog` now contains an explicit `reason` field and optional organization scope in addition to actor, action, entity, entity ID, timestamp, IP, user agent, request ID, before, and after values.

## Migration

`apps/api/prisma/migrations/20260216120000_phase3_database_foundation/migration.sql` is additive and intended to run after the Phase 2 migration.

## Seed

`apps/api/prisma/seed.ts` is now deterministic and idempotent for its development fixtures. It exercises the main Phase 3 entities, foreign-key relationships, organization hierarchy, membership, score snapshot, project relationship, notification, recommendation, workflow, workflow execution, and audit records.

The seed uses a development-only password (`ChangeMe!123456`) and must not be used as a production credential.

## Verification boundary

The repository verification script checks required Phase 3 artifacts and static schema/migration invariants. Runtime PostgreSQL/Prisma execution is only considered verified when the environment provides the required Node dependencies and PostgreSQL service.
