# Phase 31 — Network Backend Completion

## Scope
This increment closes the remaining backend domain boundary identified in `PHASE_10_NETWORK.md`: first-class person-to-person relationship edges.

The source specification requires Network to support graph, paths, best connection, and cross-company network. The existing canonical `Relationship` entity is organization-to-organization, so this increment introduces a separate first-class `PersonRelationship` entity rather than fabricating person-to-person edges from membership.

## Implemented
- First-class `PersonRelationship` Prisma model.
- Source/target person and source/target organization scope are persisted.
- Relationship type, status, health/trust/access/influence/risk/strategic/opportunity/resilience scores are supported.
- Owner/backup owner and review dates are supported.
- Soft archive and audit support.
- Organization-scope authorization is required for both endpoint organizations.
- Person-to-person graph edges are returned as `kind=person_relationship`.
- Person-to-person edges participate in shortest path and weighted best path.
- Connector, centrality, bridge, bottleneck and single-point-of-failure analysis automatically operate on the expanded graph.
- CRUD endpoints are provided for person relationships.
- Existing organization-to-organization relationships remain unchanged and continue to be first-class graph edges.

## API
- `GET /api/v1/network/person-relationships`
- `POST /api/v1/network/person-relationships`
- `PATCH /api/v1/network/person-relationships/:id`
- `DELETE /api/v1/network/person-relationships/:id` (soft archive)

Read uses `network.read`; mutations use `relationship.write` plus per-organization authorization.

## Security
- Both source and target organization scopes are checked on create/update/archive/list.
- Cross-tenant graph access remains fail-closed.
- Endpoint changes are prohibited; archive/recreate is required so ownership/scope cannot be silently moved.
- Relationship type must exist and be active.
- Self relationships are rejected.

## Verification
- Static network capability verification: PASS.
- Source brace-balance verification: PASS.
- Migration presence/shape verification: PASS.
- ZIP integrity: PASS.
- PostgreSQL/Prisma runtime validation requires a runnable database and generated Prisma Client and is not claimed as PASS in the sandbox.
