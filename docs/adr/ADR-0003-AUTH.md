# ADR-0003 — OIDC Identity Provider

Status: Accepted / Integration Foundation

Decision: Production identity should use a trusted OIDC Identity Provider. Candidates named by the technical source include Auth0, Keycloak, Microsoft Entra ID and AWS Cognito.

The repository retains domain/session interfaces for local development, but production deployment must configure an approved provider and validate issuer/audience/signature claims.
