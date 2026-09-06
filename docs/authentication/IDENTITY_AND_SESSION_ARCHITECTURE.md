# SRIP Authentication & Identity — Phase 4 Reconciliation

This implementation follows the main technical specification and the revised phase plan: production-grade Identity Provider, Login/Logout, Password Reset, Email Verification, MFA/TOTP/Recovery Codes, Session and Device Management, Login History, Suspicious Login Detection, Account Protection, Password Policy, Revocation, Global Logout, Admin Revocation, Session Expiration, Idle/Absolute Timeout, Refresh Rotation and Brute-Force Protection.

## Identity Provider

Production is configured for OIDC via `AUTH_MODE=oidc`. The API performs OIDC discovery, Authorization Code flow with PKCE (S256), state validation, nonce validation, ID-token signature/issuer/audience verification through the provider JWKS, verified-email enforcement, and account linking. Local password authentication remains available only when explicitly configured for development (`AUTH_MODE=local`).

Supported configuration slots are `OIDC_PRIMARY_*`, `OIDC_GOOGLE_*`, and `OIDC_MICROSOFT_*`; the provider is still the authoritative identity system. No OIDC client secret belongs in source control.

## MFA

TOTP secrets are encrypted with AES-256-GCM. Enrollment requires verification before recovery codes are issued. Recovery codes are hashed and single-use. Administrator roles (`SUPER_ADMIN`, `HOLDING_ADMIN`, `SUBSIDIARY_ADMIN`) are blocked from authentication until MFA is enrolled. OIDC users with MFA enabled receive a short-lived MFA completion ticket before a local application session is issued.

## Sessions

Access tokens contain a session id. Refresh tokens are random, hashed at rest, rotated on use, and reuse revokes the token family. Sessions enforce absolute and idle expiration. Every authenticated request refreshes the idle window but never extends the absolute deadline. Users can list/revoke their own sessions and globally revoke all sessions; administrators with `session.admin.revoke` can revoke another user's session.

## Security

Failed logins use progressive delay and account lockout. Successful logins are compared with the previous successful IP/User-Agent and suspicious changes generate security events. Password reset and email verification tokens are hashed and single-use. Production should use a Secret Manager for JWT/OIDC/MFA secrets and TLS for all external communication.
