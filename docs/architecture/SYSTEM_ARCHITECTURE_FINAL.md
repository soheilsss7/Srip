# Final System Architecture

```text
Users
 ├─ Web (Next.js)
 └─ Mobile (React Native + Expo)
          │
          ▼
     API Gateway / REST + OpenAPI
          │
 Authentication (OIDC/Identity Provider)
          │
 Authorization (RBAC + scoped policies)
          │
     Modular Monolith / NestJS
 ┌────────┼───────────────────────────────┐
 Auth Organization People Relationship Meeting
 Interaction Action Commitment Project Opportunity
 Network Search Notification Workflow Analytics
 AI Recommendation Reporting
 └────────┼───────────────────────────────┘
          │
   Domain + Security layer
     ┌────┼─────┐
 PostgreSQL Redis  Object Storage
    │      │          │
 pgvector BullMQ     S3-compatible
          │
       Workers
          │
 Search / RAG / AI / Recommendation
```

## Principles
1. Modular monolith first; modules have explicit boundaries.
2. One backend shared by Web and Mobile.
3. No direct database access from clients.
4. AI has no unrestricted database access.
5. Graph data starts in PostgreSQL; graph DB requires benchmark evidence.
6. Background work uses Redis + BullMQ.
7. Production identity should use a trusted OIDC provider rather than custom identity infrastructure where possible.
