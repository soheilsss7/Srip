# PHASE Q — Webhook Security & Event Contract

Canonical webhook flow:

`Raw HTTP Body -> Signature Verification -> Timestamp/Replay Protection -> Webhook Event Persistence -> Idempotency -> Normalize -> Domain Event`

Implemented:
- Nest raw body capture with `rawBody: true`.
- HMAC-SHA256 over the authenticated timestamp prefix plus the exact raw HTTP bytes (`<timestamp>.<rawBody>`), preventing an attacker from changing the timestamp without invalidating the signature.
- Timing-safe signature comparison.
- Required timestamp and configurable replay window (`WEBHOOK_MAX_SKEW_SECONDS`, default 300s).
- `IntegrationWebhookEvent` persistence with provider/eventId idempotency.
- Canonical `integration.webhook.received` domain event written through the transactional outbox.
- Duplicate event detection before reprocessing.
- Provider payload JSON parsing only after signature verification.
- No `JSON.stringify(body)` signature verification path.
