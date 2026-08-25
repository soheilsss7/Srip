# Web Runtime Test Gate — Package 8.29

This package is source-audited against the Master Technical Build Plan. Static conformance is not a substitute for runtime validation.

## Required runtime gates

1. `npm ci` (or the repository's declared package-manager equivalent)
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. API integration against isolated test PostgreSQL/Redis/Queue/Storage
6. Browser E2E:
   - Login
   - MFA
   - Create Organization
   - Create Person
   - Create Relationship
   - Create Meeting
   - Complete Meeting
   - Create Action/Commitment
   - Follow-up
   - Permission denial / IDOR
7. Security:
   - auth/session
   - authorization/RBAC/ABAC
   - XSS/CSRF/SSRF
   - upload abuse
   - rate limit
   - data leakage
8. Performance:
   - API P50/P95/P99
   - Search P95
   - Dashboard P95
   - Network progressive loading
   - DB EXPLAIN ANALYZE
   - connection pool
   - cache invalidation
9. Production gates:
   - backup integrity
   - restore test
   - disaster drill
   - monitoring alarm path
   - rollback

The Master document explicitly requires Unit, Integration, E2E and Security testing and defines production hardening around performance, security, pentest, backup/restore, DR, monitoring and load testing. These are therefore intentionally reported as runtime gates rather than falsely marked PASS by static analysis.
