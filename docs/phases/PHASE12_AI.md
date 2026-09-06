# Phase 12 — AI Gateway & Permission-Aware Intelligence

## Completed in this baseline
- Authenticated `/ai/status` and `/ai/query` boundary.
- Intent contract: smart search, meeting brief/summary, action/commitment extraction, risk/opportunity detection, next-best-action.
- Permission-aware retrieval through `AuthorizationService` before any model-facing step.
- Retrieval scoped to accessible organizations and validated relationship/meeting context.
- Deterministic gateway adapter used when no external model provider is configured; no fabricated external-model call.
- Evidence returned with every result for explainability.
- Sensitive extraction/recommendation outputs marked as requiring human confirmation.
- AI query audit event recorded in `AuditLog`.

## Still required before production
- External model provider adapter and secret management.
- Prompt/version registry and model configuration.
- RAG/vector indexing for documents and richer semantic retrieval.
- Structured output schema validation and model timeout/retry/circuit-breaker policy.
- PII/redaction policy and prompt-injection defenses for retrieved documents.
- AI evaluation dataset, regression tests, hallucination checks and quality thresholds.
- Human approval workflows that create Actions/Commitments/Opportunities.
- Usage/cost quotas, observability and provider health metrics.
- Full API/Web/Mobile UX and E2E/security verification.
