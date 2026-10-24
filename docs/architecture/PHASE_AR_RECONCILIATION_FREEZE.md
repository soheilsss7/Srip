# PHASE AR — Reconciliation / Completion Freeze

## Purpose

PHASE AR is an architecture guardrail, not a rewrite phase.
The existing foundations are retained and subsequent work must use:

> **Reconcile + Complete**

not:

> **Rewrite**

This rule applies to the current AQ baseline and every later baseline.

## Non-negotiable repository rule

1. Correct existing code is retained.
2. Incomplete existing code is completed in place or through a narrowly scoped adapter/service.
3. Code in the wrong phase is reorganized only when that improves canonical ownership; its behavior is preserved.
4. Conflicting duplicate implementations are reconciled to one canonical implementation. The duplicate is deprecated/removed only after references are migrated and verification passes.
5. No foundation is replaced merely because a cleaner implementation could be written from scratch.
6. Existing migrations and persisted data contracts are not reset or rewritten as a shortcut.
7. Existing public API behavior is preserved unless a later phase explicitly requires a versioned contract change.
8. Existing security controls must remain effective while a reconciliation is performed.
9. Every later phase must use the previous ZIP as its immutable input baseline.
10. A phase is not complete until static verification and the relevant tests pass.

## Foundation freeze list

These foundations are considered established and are **not candidates for rewrite**:

| Foundation | Canonical area | Reconciliation rule |
|---|---|---|
| Prisma / PostgreSQL | `apps/api/prisma/` | Extend schema/migrations; do not replace the data layer |
| Redis / BullMQ | `apps/api/src/event-bus/`, queue/runtime infrastructure | Extend queues and consumers; do not replace the queue foundation |
| Auth Session | `apps/api/src/auth/`, session models | Preserve session semantics; harden or extend |
| MFA | `apps/api/src/common/mfa/` | Preserve MFA contract; add missing controls |
| RBAC Foundation | `apps/api/src/authorization/`, permission models | Preserve base roles/permissions; extend enterprise policy separately |
| ABAC Foundation | `apps/api/src/common/authorization/` | Extend context/policies; do not create a second authorization engine |
| Core Domain | `apps/api/src/organizations/`, `people/`, `relationships/`, etc. | Complete domain behavior in canonical services |
| Scoring Modules | `apps/api/src/scoring/` | Extend formulas/configuration; keep scoring ownership here |
| Network Foundation | `apps/api/src/network/` | Optimize/extend PostgreSQL graph foundation before considering another graph store |
| Search Foundation | `apps/api/src/search/` | Extend permission-aware search; do not create a parallel search service |
| Notification Foundation | `apps/api/src/notifications/` | Extend rule/provider/delivery layers |
| Workflow Foundation | `apps/api/src/workflows/` | Extend execution/resume semantics; preserve event listener |
| Event Outbox Foundation | `apps/api/src/event-bus/` | Keep transactional outbox as the canonical event boundary |
| Data Import Foundation | `apps/api/src/data-management/` | Complete upload→mapping→validation→duplicate→preview→approval→import→report |
| GDPR Foundation | data lifecycle/privacy services and schema | Extend retention/erasure controls; preserve existing lifecycle semantics |
| S3 / File Security | storage/file-security areas | Extend validation and isolation; never weaken controls |
| Observability Foundation | `apps/api/src/observability/` | Extend correlation/metrics/tracing; preserve existing instrumentation |

## Canonical ownership rules

- Relationship business rules remain in Relationship services.
- Score formulas remain in `apps/api/src/scoring/`.
- Authorization remains in the canonical authorization layer.
- Field security remains part of authorization/presentation, not a new domain-specific access engine.
- Workflow execution remains in Workflow services.
- Approval persistence/decision remains in the Approval service; Workflow resume remains Workflow-owned.
- Notification rule evaluation remains in the Notification Rule Engine.
- Audit persistence remains Audit-owned.
- Domain event/outbox persistence and dispatch remain EventBus-owned.
- Integration secrets remain behind the encryption service.
- Data lifecycle remains behind the central lifecycle service.

## Change classification for later phases

### Allowed

- Additive schema migrations.
- Additive endpoints and DTOs.
- Completing missing validation/authorization/audit/event behavior.
- Performance improvements that preserve semantics.
- Replacing a duplicate implementation with the already-canonical implementation after reference migration.
- Adding tests, verification scripts, adapters and observability.

### Requires explicit reconciliation

- Changing a public API contract.
- Changing an enum/status state machine.
- Moving a service across modules.
- Replacing a persistence mechanism.
- Changing authorization semantics.
- Changing event names or payload contracts.

### Forbidden as a shortcut

- Deleting a previous phase's working feature.
- Rebuilding an established foundation from zero.
- Creating a second implementation of the same canonical engine.
- Dropping/resetting production data or migrations.
- Disabling security controls to make tests pass.
- Bypassing canonical services with direct Prisma writes for their owned concerns.

## Completion gate

PHASE AR is complete when:

- every frozen foundation has a canonical location;
- every listed foundation is present in the repository;
- no required foundation has been removed from the AQ baseline;
- the reconciliation policy is executable through the verification script;
- the policy is documented for future phases.

This phase deliberately introduces **no frontend or AI implementation changes**.
