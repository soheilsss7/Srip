# SRIP — Final Product Requirements

## Product
Strategic Relationship Intelligence Operating System for a holding company and its subsidiary network.

## Primary outcomes
- Answer who knows whom, who can introduce whom, relationship strength, last interaction, open commitments, risks, and next best action.
- Support Web + Mobile through one shared backend and API.
- Preserve a modular-monolith architecture and avoid premature microservices/graph database complexity.

## Core domains
Organization, Person, Relationship, Interaction, Meeting, Action, Commitment, Project, Opportunity, Network, Search, Notifications, Workflow, Analytics, AI, Recommendation, Integrations, Security, Audit.

## Non-functional requirements
- Production-grade authentication and authorization.
- Tenant/organization isolation.
- Auditability for sensitive operations.
- PostgreSQL as core data store; Redis/BullMQ for cache and jobs.
- PostgreSQL FTS initially; OpenSearch only after measured need.
- pgvector initially for RAG.
- S3-compatible object storage for files.
- OWASP ASVS 5.0 and mobile security controls as the security baseline.
- AI must remain an intelligent layer over Database + Domain Logic + API + Security.

## Feature delivery rule
Every feature follows: Requirement → UX → Entity → Database → API → Business Logic → Authorization → Web → Mobile → Tests → Security → Deployment.
