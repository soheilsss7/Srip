# Phase 4 — Authentication Complete

## Scope

This phase implements the authentication layer described by the phased execution document while keeping enterprise OIDC/SSO integration as a foundation rather than claiming a production identity-provider integration.

## Implemented

- Local user registration with password policy and bcrypt cost 12.
- Login with normalized email and generic invalid-credential responses.
- Failed-login counter and temporary lockout after repeated failures.
- Access JWTs with a session identifier (`sid`).
- Opaque refresh tokens stored only as SHA-256 hashes.
- Refresh-token rotation with token-family tracking and reuse detection.
- Session expiration and explicit revocation.
- Logout and revoke-all session controls.
- Password reset tokens are hashed, single-use, and time-limited.
- Password changes revoke all active sessions.
- Email verification tokens are hashed, single-use, and time-limited.
- Development-only token visibility for reset/verification flows; production responses never expose tokens.
- Account model for local/OIDC/SAML identities.
- IdentityProvider configuration foundation for future OIDC/SSO integration; provider secrets are represented as encrypted-at-rest fields and must be backed by KMS/secret management before production.
- AuthGuard validates both JWT and the backing session/user state, so logout/revocation invalidates the bearer session.

## API

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password-reset/request`
- `POST /api/v1/auth/password-reset/confirm`
- `POST /api/v1/auth/email/verify`
- `POST /api/v1/auth/email/resend` (authenticated)
- `GET /api/v1/sessions` (authenticated)
- `POST /api/v1/sessions/revoke-all` (authenticated)

## Security boundary

This phase does not claim MFA, rate limiting, WAF, production OIDC execution, SSO protocol validation, KMS integration, or external penetration testing. Those remain later security/production gates.

## Verification boundary

Static checks are provided by `scripts/verify.sh`. Runtime database migration, Prisma client generation, integration tests, and end-to-end authentication tests require the repository dependencies and PostgreSQL runtime to be available.
