# PHASE V/W/X — Data Quality, Duplicate Detection, Import

## V — Data Quality
Canonical checks:
1. Duplicate Organizations
2. Missing Owners
3. Missing Contacts
4. Stale Relationships
5. Invalid Emails
6. Missing Organizations
7. Missing Dates
8. Incomplete Profiles

## W — Duplicate Detection
Organization signals:
- Name similarity
- Domain
- Registration ID
- Phone
- Country

Person signals:
- Name
- Email
- Organization
- Phone

Pipeline: Normalize → Candidate Generation → Similarity → Duplicate Score → Warning → User Approval → Create/Update.

## X — Import
Pipeline is persisted as `ImportPipelineStage`:
Upload → Mapping → Validation → Duplicate Detection → Preview → Approval → Import → Report.

`DataImport.pipelineStage` and `DataImport.status` are advanced as the import progresses. No import mutation occurs before approval.
