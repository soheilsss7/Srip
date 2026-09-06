# Backend Baseline — Phase A Contract Freeze

## Status

This document freezes the repository baseline used for the backend reconciliation work.

**Baseline source:** `srip-starter-2_PHASE0_TO_PHASE39_TESTING_COMPLETE_UNIFIED(1).zip`

## Scope

This baseline applies to backend and backend infrastructure only.

Included:
- `apps/api/`
- backend database schema and migrations
- backend tests
- backend verification scripts
- backend deployment/runtime configuration
- backend documentation and contracts

Explicitly out of scope for this audit/reconciliation cycle:
- frontend/mobile implementation
- AI implementation

Those areas remain in the repository and are preserved unchanged unless a later backend contract explicitly requires an interface update.

## Non-destructive reconciliation rule

1. Correct existing implementation is preserved.
2. Incomplete implementation is completed.
3. Conflicting implementations are reconciled to one canonical implementation.
4. Duplicate implementations are deprecated/removed only after their behavior is preserved by the canonical implementation.
5. No Phase 0–39 backend capability is removed merely because its original phase placement is no longer canonical.
6. Every completed phase becomes the baseline for the next phase.

## Contract-freeze rules

The backend contract is frozen around these boundaries:

`Requirement → Entity → Database → Migration → API → DTO → Validation → Business Logic → Authorization → Audit → Domain Event → Workflow/Notification → Analytics → Tests → Observability → Deployment`

Changes in later phases must preserve backward compatibility where the product contract requires it, or provide an explicit migration/reconciliation path.

## Current canonical backend structure

```text
apps/api/
├── prisma/
├── src/
│   ├── auth/
│   ├── authorization/
│   ├── common/
│   ├── organizations/
│   ├── people/
│   ├── relationships/
│   ├── interactions/
│   ├── meetings/
│   ├── actions/
│   ├── commitments/
│   ├── projects/
│   ├── opportunities/
│   ├── requirements/
│   ├── network/
│   ├── scoring/
│   ├── workflows/
│   ├── notifications/
│   ├── integrations/
│   ├── audit/
│   ├── analytics/
│   └── data-management/
└── test/
```

Additional backend modules may exist; they are preserved.

## Phase A acceptance criteria

- Backend directory structure is present.
- Prisma schema exists and is validly structured for the current repository.
- Existing migrations are preserved.
- Existing tests and verification scripts are preserved.
- No frontend/mobile/AI files are deleted or altered as part of Phase A.
- This file is included in every subsequent backend baseline until superseded by a newer baseline document.

## Phase B.1 change included in this baseline

Relationship tagging is now represented at the database contract level through `RelationshipTag`.

The relation is:
- `Relationship.tags -> RelationshipTag[]`
- `Tag.relationships -> RelationshipTag[]`

with a composite primary key on `(relationshipId, tagId)` and cascading deletion from either parent.

This establishes the database contract only. Tag assignment API/business logic is intentionally deferred to its own phase so that it can be implemented and tested end-to-end without mixing concerns.

## Baseline identifier

The next baseline is this archive itself:

`srip-starter-2_PHASEA_PHASEB1_BACKEND_BASELINE.zip`

Do not use the original Phase 0–39 archive as the source for the next edit once this archive has been accepted as the completed baseline.
