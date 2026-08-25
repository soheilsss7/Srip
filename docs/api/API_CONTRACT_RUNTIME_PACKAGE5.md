# Package 5 — API Contract / Error / Idempotency / Health / Runtime

## Baseline
This package is built from `srip-starter-2_PACKAGE4_NOTIFICATION_WORKFLOW_APPROVAL_INTEGRATION_IMPORT_EXPORT_BASELINE.zip` without removing prior implementation.

## Contract
- Canonical REST prefix: `/api/v1`
- OpenAPI 3.1 / Swagger
- Bearer authentication on protected routes
- `X-Request-Id` and `X-Correlation-Id` propagation
- Stable error envelope: `error.code`, `message`, `requestId`, `details`
- Pagination contract: page/cursor/limit/sort/order where applicable
- Idempotency for authenticated retry-sensitive mutations, exports and signed webhooks
- Raw webhook body hashing for webhook idempotency
- Canonical liveness/readiness endpoints with compatibility aliases

## Hardening completed
- Error details are recursively sanitized for credentials/secrets and bounded in size.
- Unexpected 5xx responses use generic operational messages rather than leaking provider/runtime exception text.
- Exception boundary generates a request ID if middleware did not populate one.
- Idempotency namespace is explicitly separated between authenticated users and webhook providers.
- Webhook idempotency fails closed when raw body capture is unavailable.
- Queue readiness validation rejects negative numeric queue metrics.

## Verification
Static verification must pass before this ZIP becomes the next baseline. Runtime integration requires PostgreSQL and Redis and is executed only when `RUN_INTEGRATION=1` is enabled.
