# Security Gate

## Implemented foundation
- Helmet security headers in API.
- CORS is explicitly configured.
- DTO validation with whitelist/forbidNonWhitelisted.
- Password hashing with bcrypt cost 12 in the development auth foundation.
- Environment-based secrets.
- Prisma parameterized access.

## Mandatory before production
- [ ] Replace development JWT/password auth with a production OIDC/IdP architecture.
- [ ] MFA for admins and sensitive roles.
- [ ] Secure refresh-token/session rotation and revocation.
- [ ] RBAC + ABAC and object-level authorization tests (including IDOR).
- [ ] Rate limiting and brute-force controls.
- [ ] CSRF strategy where cookie auth is used.
- [ ] Secret manager/KMS.
- [ ] TLS/WAF/DDoS protection.
- [ ] Immutable audit log for sensitive actions.
- [ ] File malware scanning and signed URLs.
- [ ] SAST/DAST/dependency scanning.
- [ ] OWASP ASVS 5.0 verification.
- [ ] Mobile security review.
- [ ] External penetration test and remediation.
- [ ] GDPR/privacy/retention/legal review.
