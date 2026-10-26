# Database Architecture

PostgreSQL is the system of record. The schema is organized around tenant-aware business entities and explicit ownership.

Core entity groups:
- Identity: User, Account, Session, LoginHistory, MFA/Recovery foundations.
- Organization: Organization, Membership.
- People: Person.
- Relationship: Relationship, RelationshipScoreSnapshot.
- Activity: Interaction, Meeting, MeetingParticipant, Action, Commitment, Note.
- Delivery: Project, Requirement, ProjectRelationship, Opportunity.
- Intelligence: Recommendation, score snapshots, Network projections.
- Platform: Notification, Workflow, WorkflowExecution, AuditLog, Permission, RolePermission, AuthorizationPolicy.
- Files: Document metadata with external object-storage key.

Soft delete is used for important entities. Sensitive actions are auditable. Tenant scope is explicit on organization-bound data.
