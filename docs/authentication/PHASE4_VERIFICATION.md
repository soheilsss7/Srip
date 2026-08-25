# Phase 4 Verification Scope

Static implementation gate:
- OIDC discovery + PKCE + state + nonce + JWKS validation
- Verified email requirement
- OIDC account linking
- Local login disabled when AUTH_MODE=oidc
- Email verification + password reset
- TOTP + encrypted secret + recovery codes
- Mandatory MFA for administrator roles
- Refresh token rotation and reuse detection
- Session idle + absolute timeout
- Session/device list and self-revocation
- Global logout
- Admin session revocation permission
- Login history
- Suspicious login security events
- Progressive brute-force delay + lockout

Runtime gates still require real OIDC credentials, Redis, PostgreSQL, TLS and end-to-end authentication tests.
