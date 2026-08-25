# PHASE AF — Controller Security Matrix

## Canonical categories

Every backend controller is classified exactly once as one of:

- `PUBLIC` — no application authentication is required. A controller may document narrow authenticated route exceptions.
- `AUTHENTICATED` — a valid application session is required; a domain permission is not mandatory at controller level.
- `AUTHORIZED` — authentication plus resource/permission authorization is required; `@RequirePermission()` must be present.
- `INTERNAL` — endpoint is reachable only from explicitly trusted internal infrastructure (for example metrics/observability).
- `WEBHOOK_SIGNED` — external machine-to-machine callback; raw body and signature/timestamp are required before the handler is reached. Cryptographic verification remains in the canonical integration service.
- `HEALTH` — liveness/readiness/health probes are intentionally unauthenticated.

## Important reconciliation

The old test incorrectly required `AuthGuard + AuthorizationGuard + RequirePermission` on every controller. That is not a valid universal rule. Health probes, public authentication flows, session-authenticated MFA/notifications, signed webhooks and internal metrics have different trust boundaries.

`AuthController` is intentionally `PUBLIC` with one documented exception: `POST auth/email/resend` is protected by `AuthGuard`.

`MetricsController` and `ObservabilityController` are `INTERNAL` and use `InternalMetricsGuard` rather than an application-user permission.

`IntegrationWebhookController` is `WEBHOOK_SIGNED`; `WebhookSignatureGuard` performs the controller-level structural gate and `IntegrationsService.webhook()` remains the canonical HMAC/timestamp/idempotency verifier.

`UsersController` is administrative and therefore `AUTHORIZED` with `admin.users`.

## Verification invariant

The matrix test fails if:

1. a controller is missing from the matrix;
2. the matrix contains a stale controller entry;
3. a category's required security contract is missing;
4. an intentional exception is no longer explicit.
