# Phase 9 Completion Checklist

## Implemented in this ZIP
- [x] Actions CRUD + soft delete
- [x] Actions context links: relationship / meeting / person / project
- [x] Commitments CRUD + soft delete
- [x] Commitments context links: relationship / meeting / person / project
- [x] Projects CRUD + soft delete
- [x] Requirements CRUD + soft delete
- [x] Project ↔ Relationship linking/unlinking
- [x] Project aggregates for actions, commitments and opportunities
- [x] Opportunities CRUD + soft delete
- [x] Opportunity probability/status/value
- [x] Opportunity ↔ organization/project/relationship context
- [x] Organization-scope authorization checks on context resources
- [x] Web read workspaces for actions, commitments, projects and opportunities
- [x] Prisma schema relationship for Opportunity ↔ Relationship
- [x] SQL migration for the new relationshipId column and foreign key
- [x] Static verification for Phases 0–9
- [x] Full ZIP integrity verification

## Still required before Phase 9 can be marked Runtime Complete
- [ ] Install dependencies in a clean environment
- [ ] `prisma generate`
- [ ] Apply migrations against PostgreSQL
- [ ] Seed and verify deterministic fixtures
- [ ] API runtime CRUD verification
- [ ] Integration tests for all four domains
- [ ] Cross-tenant / IDOR E2E tests
- [ ] Browser E2E tests
- [ ] Mobile implementation and E2E
- [ ] AuditLog before/after verification for all mutations
- [ ] Staging deployment and UAT
