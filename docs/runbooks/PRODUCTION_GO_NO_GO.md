# Production GO / NO-GO Procedure

## GO requires
1. All mandatory checklist items are checked.
2. No unresolved critical/high security finding without formal acceptance.
3. Production secrets are provisioned through the approved secret manager.
4. Backup and restore evidence is current.
5. Staging migration and rollback drills passed.
6. Monitoring and alert routing were tested.
7. Product UAT and legal/privacy approvals are recorded.
8. Mobile release gates are approved if mobile is in scope.
9. Release evidence manifest contains links/IDs for every mandatory gate.
10. Named approvers sign the final decision.

## NO-GO triggers
- Any mandatory evidence missing.
- Placeholder/default production secret detected.
- Failed migration/restore drill.
- Unresolved critical security issue.
- Authentication/authorization regression.
- Monitoring or alerting unavailable.
- Rollback path not rehearsed.
- Product/legal/privacy approval missing.

## Decision record
- Version:
- Commit SHA:
- Date/time UTC:
- Release owner:
- Technical approver:
- Security approver:
- Product approver:
- Decision: GO / NO-GO
- Evidence manifest revision:
- Notes:
