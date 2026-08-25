# Phase 23 — Core Domain Contract Reconciliation

This document records the final Core Domain contract reconciliation against the source checklist and the new phase plan.

## Source contract

The source document explicitly lists these Core Domain entities: User, Role, Permission, Organization, OrganizationType, OrganizationUnit, Person, Relationship, RelationshipType, Interaction, InteractionType, Meeting, MeetingParticipant, Action, Commitment, Project, ProjectRequirement, Opportunity, Recommendation, ConnectionPath, Referral, Document, Note, Tag, Notification, Workflow, WorkflowExecution, AuditLog, Score and ScoreSnapshot. The source also requires independent Score services and Score formula versioning.

## Canonical mappings

| Source contract | Repository implementation | Status |
|---|---|---|
| ProjectRequirement | `ProjectRequirement` Prisma model mapped to existing `Requirement` table | Canonical |
| RelationshipType | `RelationshipType` Prisma model mapped to existing `RelationshipTypeCatalog` table | Canonical |
| InteractionType | `InteractionType` catalog entity + `InteractionKind` enum for bounded values | Canonical |
| Score | Generic `Score` entity, with specialized RelationshipScoreService retained | Canonical |
| ScoreSnapshot | Generic immutable `ScoreSnapshot`, with specialized RelationshipScoreSnapshot retained for relationship history | Canonical |

No existing data is intentionally discarded. Existing physical tables are reused through Prisma `@@map` where safe, while additive reference fields and canonical entities are introduced through migration.

## Core Domain coverage

- Organization / Holding / Subsidiary / OrganizationUnit / Person / Contact Information / Ownership
- Relationship / RelationshipType / Status / Owner / Backup Owner / Scores / Timeline
- Interaction / InteractionType / Follow-up / Timeline
- Meeting / Participants / Agenda / Brief / Decisions / Actions / Commitments / Summary
- Action / Deadline / Status / Dependency / Completion / Outcome
- Commitment / Owner / Deadline / Status / Evidence / Completion / Risk
- Project / Requirements / Project Relationships / Actions / Risks / Opportunities / Milestones
- Requirement matching: direct, indirect, internal, external, recommended connectors, strength and success probability
- Connection Path: direct, 1-hop, 2-hop, multi-hop, best connector and path strength
- Referral
- Notification
- Workflow / WorkflowExecution
- AuditLog
- Score / ScoreSnapshot / ScoreVersion / ScoreCalibration

## Compatibility policy

The public relationship API continues to accept the stable `relationshipType` key, while the canonical `RelationshipType` entity is referenced by `relationshipTypeId`. Interaction APIs continue to accept the bounded `type` value, while the canonical `InteractionType` catalog is referenced by `interactionTypeId`. This avoids breaking existing clients while making the source entities first-class domain records.

## Migration

`20260823190000_phase23_core_domain_contract_reconciliation` is additive. It:

1. Renames the legacy PostgreSQL InteractionType enum to InteractionKind.
2. Creates the canonical InteractionType catalog.
3. Backfills Relationship.relationshipTypeId from the existing relationship type key.
4. Backfills Interaction.interactionTypeId from the existing enum value.
5. Creates generic Score and immutable ScoreSnapshot tables.
6. Preserves existing Requirement and RelationshipTypeCatalog physical tables through Prisma mappings.

## Verification gate

Static verification must confirm:

- canonical Prisma model names exist;
- no old Prisma client model references remain in application code;
- migration is present and additive;
- seed creates canonical type catalogs and score records;
- TypeScript source has no syntax errors;
- ZIP integrity passes;
- baseline files are not deleted.

Runtime PostgreSQL/Prisma migration execution, API integration tests, E2E, IDOR/authorization tests, performance testing and staging/UAT remain runtime gates rather than claims of source-only verification.
