# Phase 15 — Security / Audit / Compliance

## Implemented
- Security event model and tenant-aware read APIs.
- Export audit trail model and tenant-aware history API.
- Severity/type taxonomy for security events.
- Existing AuditLog remains the canonical business audit trail.
- Helmet, request IDs and disabled x-powered-by remain enabled from the existing API baseline.
- Data classification taxonomy remains `PUBLIC/INTERNAL/CONFIDENTIAL/RESTRICTED/PRIVATE`.

## Runtime gates still required
- Execute Prisma migration against PostgreSQL.
- Wire authentication/authorization failures into `SecurityService.record` at runtime.
- Wire every export producer through `SecurityService.exportLog`.
- Add rate limiting and abuse protection at gateway/runtime level.
- Validate retention/erasure policies with legal/product requirements before enabling destructive jobs.
- Run IDOR, tenant-isolation, security-header and dependency scanning tests.
