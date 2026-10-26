# Phase I — Audit Architecture

Canonical audit path: RequestContext -> AuditService -> AuditLog.

RequestContext carries requestId, correlationId, authenticated userId, client IP and user-agent through AsyncLocalStorage. Authenticated requests bind userId in AuthGuard. AuditService automatically enriches every mutation with request metadata and redacts credentials/tokens/secrets from before/after payloads.

Covered audit classes: CREATE, UPDATE, DELETE, RESTORE, PERMANENT_DELETE, EXPORT, LOGIN, LOGOUT, PERMISSION_CHANGE, APPROVAL, TOKEN_CHANGE, INTEGRATION_CHANGE, plus the existing specialized tag/custom-field/lifecycle/approval actions.

Direct Prisma AuditLog writes outside AuditService are prohibited; AI audit writes are routed through AuditService.
