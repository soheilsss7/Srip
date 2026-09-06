# ADR-0004 — AI Gateway Boundary

Status: Accepted

Decision: AI is accessed only through an application gateway that authenticates, authorizes, retrieves permitted context, applies business logic, calls a model, validates output, and audits sensitive actions.

AI must never receive unrestricted database access.
