# Phase 22 — RBAC / ABAC Reconciliation

This phase reconciles authorization with the source specification's sections on Authorization, RBAC, ABAC, Data Isolation and Multi-Company Architecture.

## RBAC

- [x] Super Admin
- [x] Holding Admin
- [x] Holding Executive
- [x] Subsidiary Admin
- [x] Subsidiary Executive
- [x] Relationship Manager
- [x] Project Manager
- [x] Analyst
- [x] Standard User
- [x] Read Only
- [x] System Role catalog
- [x] Role-to-permission catalog
- [x] Custom non-system roles
- [x] Role permission administration
- [x] Membership role assignment
- [x] Membership revocation
- [x] Role grant hierarchy prevents privilege escalation

## ABAC

- [x] Role attribute
- [x] Organization attribute
- [x] Subsidiary hierarchy scope
- [x] Department attribute
- [x] Department unit attribute
- [x] Data classification
- [x] Ownership / creator checks
- [x] Relationship sensitivity
- [x] User access scope
- [x] Shared / private / restricted visibility handling
- [x] Organization isolation
- [x] Policy role matcher
- [x] Policy department matcher
- [x] Policy subject-scope matcher
- [x] Policy maximum classification
- [x] JSON conditions: all/any/not + eq/neq/in/notIn/contains/startsWith/exists/gte/lte
- [x] Explicit DENY precedence
- [x] Permission grant remains required after ABAC evaluation

## Multi-company

- [x] Multiple memberships per user
- [x] Holding hierarchy traversal
- [x] Holding-admin / holding-executive descendant access
- [x] Subsidiary scoped access
- [x] Department scoped access
- [x] Organization-scoped records
- [x] Central authorization service used by API guards/services

## Administration API

- [x] GET /authorization/roles
- [x] POST /authorization/roles
- [x] PUT /authorization/roles/:role/permissions
- [x] GET /authorization/memberships
- [x] POST /authorization/memberships
- [x] DELETE /authorization/memberships/:id
- [x] POST /authorization/evaluate

## Security guarantees

- [x] No unknown permission can be granted at runtime
- [x] No inactive role can be assigned
- [x] Super Admin cannot be granted by non-Super Admin
- [x] Subsidiary Admin cannot grant admin roles
- [x] Holding Admin cannot grant Super Admin
- [x] Membership changes are audited
- [x] Authorization is fail-closed

## Runtime gates still requiring environment

- [ ] PostgreSQL migration execution
- [ ] Multi-tenant integration test matrix
- [ ] IDOR test matrix for every resource
- [ ] Role/permission regression suite
- [ ] ABAC policy condition integration tests
- [ ] Load test of hierarchical scope resolution
