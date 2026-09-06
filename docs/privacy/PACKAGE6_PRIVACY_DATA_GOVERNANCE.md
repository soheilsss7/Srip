# Package 6 Privacy and Data Governance Contract

For each governed data type the repository models purpose/legal basis, classification, retention, exportability and erasability through `DataProcessingPolicy`.

Lifecycle states are `CREATION`, `ACTIVE`, `ARCHIVED`, `RETENTION`, `DELETION`, `RESTORED`, and `PURGED`.

Privacy requests are user-scoped and support `ACCESS`, `EXPORT`, and `ERASURE`. Erasure revokes sessions and authentication artifacts and anonymizes the user record while preserving legally required records according to active processing policies.

Sensitive relationship/person fields are protected through field-level permissions. Audit records redact secrets, tokens, credentials and full document/body content.

Production secrets must be supplied through a secret-management mechanism; `.env` files and environment-specific credentials are excluded from source control.
