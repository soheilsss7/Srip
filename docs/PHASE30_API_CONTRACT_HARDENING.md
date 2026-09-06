# Phase 30 — API Contract Hardening

Baseline: Phase 0→29.

## Contract guarantees

- `/api/v1` is applied before Swagger document generation.
- Standard success collections are normalized to `{items,nextCursor,total}` for array responses.
- `page`, `cursor`, `limit`, `sort`, and `order` are accepted contract parameters for GET collection responses; server output is capped at 200 items.
- Errors are normalized to `{code,message,requestId,details?}` for Nest-handled exceptions and the hardening middleware uses the same shape for early HTTP failures.
- `X-Request-Id` is generated/echoed and `X-Correlation-Id` is generated/echoed on every request.
- Authenticated mutations require `Idempotency-Key` (16–255 chars), except public authentication bootstrap endpoints. The request body is fingerprinted; key reuse with a different payload is rejected. Successful JSON mutation responses are persisted for replay until TTL expiry.
- Sensitive fields are removed centrally from API output: password hashes, encrypted OAuth tokens, OAuth state hashes, client secrets, API keys, private keys, recovery codes.
- OpenAPI is generated at runtime and hardened with canonical pagination, correlation/request headers, idempotency header, security, and standard error responses. Startup validation fails if required canonical paths are missing.
- Swagger JSON is available at `/docs-json` and UI at `/docs`.

## Persistence

`IdempotencyRecord` stores request fingerprint, actor, route, response, response headers, status code and expiry. Migration: `20260103120000_api_contract_hardening`.

## Verification

`scripts/verify-api-contract.sh` performs static contract verification. Full runtime verification still requires the project's PostgreSQL/Redis/dependency environment.
