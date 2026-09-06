# API Contract / Error / Idempotency / Health / Runtime — Phase 5

This document records the backend contract implemented in the Phase 5 baseline.

## API contract

- Canonical prefix: `/api/v1`
- REST/JSON
- OpenAPI 3.1 + Swagger
- Bearer authentication for protected resources
- `X-Request-Id` and `X-Correlation-Id` are generated/propagated by middleware
- Pagination supports `page`, `cursor`, `limit`, `sort`, and `order` where the endpoint is a collection
- Resource-specific filters remain defined by each controller/query contract
- Webhook contracts are documented as signed inbound events

## Error envelope

```json
{
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Access denied",
    "requestId": "...",
    "details": {}
  }
}
```

Stable domain/application codes:

`AUTH_REQUIRED`, `AUTH_INVALID`, `ACCESS_DENIED`, `ORG_SCOPE_DENIED`, `FIELD_ACCESS_DENIED`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `DUPLICATE_RESOURCE`, `APPROVAL_REQUIRED`, `RATE_LIMITED`, `IDEMPOTENCY_CONFLICT`, `INTEGRATION_ERROR`.

Operational transport fallbacks are `INTERNAL_ERROR` and `SERVICE_UNAVAILABLE` so unexpected 5xx responses never masquerade as validation failures.

## Idempotency

`Idempotency-Key` is required for authenticated `POST`, `PUT`, `PATCH`, and `DELETE` operations, report exports, and signed integration webhooks.

The request hash is bound to the authenticated principal (or webhook identity), HTTP method, route and request content. Reusing a key with different request content returns `IDEMPOTENCY_CONFLICT`; concurrent reuse returns the same stable conflict code; completed requests replay the stored response.

Webhook signatures are verified from the raw HTTP body before webhook persistence/normalization, and the raw body hash is used for idempotency.

## Health / runtime

Canonical dependency-aware endpoints:

- `/api/v1/health`
- `/api/v1/health/liveness`
- `/api/v1/health/readiness`

Compatibility aliases remain:

- `/api/v1/health/live`
- `/api/v1/health/ready`

Readiness checks API dependencies represented by the backend runtime: PostgreSQL, Redis, queue monitoring and storage configuration. Dependency failure details are intentionally sanitized; credentials, provider messages and connection strings are not returned to public health callers.

## Verification

The Phase 5 static contract verification is `apps/api/scripts/verify-phase5-api-runtime.sh`.
Runtime PostgreSQL/Redis integration remains an environment-dependent test and is enabled through the existing `RUN_INTEGRATION=1` integration test suite.
