# Phase 9 — Actions / Commitments / Projects / Opportunities

## Scope
Phase 9 turns the Phase 8 meeting/interaction context into executable work and business outcomes.

## Implemented contract
- Actions: CRUD, ownership/context authorization, due dates, status, priority, relationship/meeting/person/project links, soft delete.
- Commitments: CRUD, owner/context authorization, due dates, status, relationship/meeting/person/project links, soft delete.
- Projects: CRUD, requirements CRUD, project↔relationship links, owner/organization scope, soft delete.
- Opportunities: CRUD, organization/project/relationship context, probability, status, soft delete.
- Project detail aggregates requirements, relationships, opportunities, actions and commitments.
- Meeting-created actions/commitments remain first-class linked records through meetingId.

## Completion gate
Static implementation is complete for the Phase 9 API and web workspace. Runtime completion remains gated on PostgreSQL/Prisma migration, integration tests, E2E authorization tests, browser verification, mobile flows and staging verification.

## Acceptance scenarios
1. Authorized user can create an action from a meeting and assign a due date.
2. Authorized user can create a commitment from a meeting and move it through OPEN → FULFILLED/OVERDUE/CANCELLED.
3. Authorized user can create a project, requirements and relationship links.
4. Authorized user can create an opportunity and link it to an organization, project and/or relationship.
5. Cross-organization IDs cannot be used to bypass authorization.
6. Deleted records disappear from normal lists and remain recoverable only through controlled administrative workflows.
