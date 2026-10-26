# PHASE AA — Distributed Redis Rate Limiting

The API rate limiter is Redis-backed and application-instance independent.

## Runtime contract

`RateLimitService.consume({ ip, userId, endpoint, category })` evaluates:

- `rate:global`
- `rate:ip:{ip}`
- `rate:user:{userId}` when authenticated
- `rate:endpoint:{endpoint}`
- `rate:login:{ip}` for login
- `rate:sensitive:{userId}` for sensitive mutations

Counters are incremented atomically in Redis with a Lua script and a TTL.

## Endpoint categories

- login
- password reset
- MFA
- export
- search
- bulk import
- webhooks
- sensitive mutations

Each category has an independent configurable limit/window. The global, IP, user and endpoint dimensions remain active in parallel.

## Failure behavior

Redis failure is fail-closed by default (`RATE_LIMIT_FAIL_OPEN=false`). This prevents a Redis outage from silently disabling security controls. Fail-open is an explicit deployment override and should not be used for sensitive production traffic.

## Important reconciliation

The previous process-local `Map` limiter in `production-hardening.ts` was removed. It could not enforce a consistent limit across multiple API replicas. `ProductionHardeningMiddleware` remains responsible for request-size and security headers only; distributed rate limiting is owned by `RateLimitInterceptor`.
