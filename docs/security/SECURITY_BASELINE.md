# Security Baseline

- OWASP ASVS 5.0 target for API/backend.
- Mobile security controls target for React Native.
- Helmet/security headers enabled.
- Input validation enabled globally.
- JWT/OIDC validation at API boundary.
- RBAC and tenant/resource authorization.
- Audit for sensitive operations.
- Soft delete and controlled restore/permanent-delete permissions.
- Password hashing uses bcrypt in the current local-development auth path.
- Secrets belong in environment/secret manager, never source control.
- File upload controls: MIME/extension/size validation, random storage keys, access control, signed URL abstraction, expiry and malware scanning integration point.
- AI controls: prompt injection protection, data leakage prevention, permission-aware retrieval, sensitive data filtering, output validation, tool boundaries and approval for sensitive actions.
