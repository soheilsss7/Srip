# PHASE AP — Idempotency Contract

## Scope
The canonical retry-safety contract applies to retry-sensitive `POST`, `PUT`, `PATCH`, and `DELETE` operations, plus report exports and signed integration webhooks.

Covered operations include Create Relationship, Create Meeting, Create Action, Create Commitment, Import, Export, and Webhook.

## Header
`Idempotency-Key` is required for covered operations and must contain 16–255 characters.

## Request identity
The server binds the key to the authenticated principal (or signed webhook namespace), HTTP method, route, and request payload. Webhooks use the **raw HTTP body** for request hashing so JSON re-serialization cannot change the idempotency identity.

## Behaviour
1. First request claims an `IdempotencyRecord`.
2. A concurrent request with the same key receives `IDEMPOTENCY_CONFLICT` while the first request is in progress.
3. Reuse with a different request payload receives `IDEMPOTENCY_CONFLICT`.
4. A completed request replays the stored status, headers, and response.
5. Binary exports are stored as Base64 in `responseBodyBase64` so retries reproduce the same bytes.
6. Failed requests remove the in-progress claim, allowing a safe retry.
7. Records expire according to `IDEMPOTENCY_TTL_MS` (default 24 hours).

## Webhooks
Webhook authentication remains signature-based. Idempotency is an additional protection layer and uses the raw body hash. Signature verification remains responsible for authenticity; idempotency prevents duplicate processing.

## Import / Export
Import mutations use the same global contract. Export is treated as a sensitive externally observable operation and therefore requires an idempotency key even on the existing GET export route.

## Stable error
All conflicts normalize through the Phase AO envelope with `IDEMPOTENCY_CONFLICT`.
