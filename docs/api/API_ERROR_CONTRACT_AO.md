# PHASE AO — Canonical API Error Contract

All HTTP API errors use one envelope. No controller may return a second error shape.

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

## Stable error codes

- `AUTH_REQUIRED`
- `AUTH_INVALID`
- `ACCESS_DENIED`
- `ORG_SCOPE_DENIED`
- `FIELD_ACCESS_DENIED`
- `VALIDATION_ERROR`
- `RESOURCE_NOT_FOUND`
- `DUPLICATE_RESOURCE`
- `APPROVAL_REQUIRED`
- `RATE_LIMITED`
- `IDEMPOTENCY_CONFLICT`
- `INTEGRATION_ERROR`

## Compatibility

Existing internal/legacy codes are normalized at the global exception boundary. For example:

- `UNAUTHENTICATED` / `UNAUTHORIZED` → `AUTH_REQUIRED`
- `FORBIDDEN` → `ACCESS_DENIED`
- `NOT_FOUND` → `RESOURCE_NOT_FOUND`
- `CONFLICT` → `DUPLICATE_RESOURCE`
- `IDEMPOTENCY_KEY_REUSED` / `IDEMPOTENCY_REQUEST_IN_PROGRESS` → `IDEMPOTENCY_CONFLICT`
- validation `400/422` → `VALIDATION_ERROR`

This avoids breaking existing domain code while exposing a stable public contract.

## Security

`requestId` is always returned. `details` is always an object and must never contain secrets, access/refresh tokens, password hashes, private keys, or raw integration credentials. The existing response sanitization remains active.

## HTTP mapping

| HTTP | Canonical code |
|---|---|
| 400 / 422 | `VALIDATION_ERROR` |
| 401 | `AUTH_REQUIRED` or `AUTH_INVALID` |
| 403 | `ACCESS_DENIED`, `ORG_SCOPE_DENIED`, or `FIELD_ACCESS_DENIED` |
| 404 | `RESOURCE_NOT_FOUND` |
| 409 | `DUPLICATE_RESOURCE` or `IDEMPOTENCY_CONFLICT` |
| 429 | `RATE_LIMITED` |
| 5xx integration failures | `INTEGRATION_ERROR` |

Controllers and services should provide a canonical `code` when a more specific stable code is known. The global filter is the final enforcement boundary.
