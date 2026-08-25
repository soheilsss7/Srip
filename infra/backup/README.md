# Production Backup / PITR Foundation

This directory contains the repository implementation for the technical specification's Backup (section 90), Disaster Recovery (91) and Restore Test (92) requirements.

## Required production configuration

- `BACKUP_S3_URI`: S3-compatible bucket/prefix for encrypted backups and WAL.
- `BACKUP_S3_SSE`: `AES256` or `aws:kms`.
- `BACKUP_S3_KMS_KEY_ID`: required when using KMS.
- `BACKUP_ENCRYPTION_KEY`: secret used for repository-side encryption of logical/base backups.
- `BACKUP_RETENTION_DAYS`: default 35.
- `RPO_TARGET_MINUTES`: target after final needs assessment; example 15.
- `RTO_TARGET_MINUTES`: target after final needs assessment; example 60.

WAL is archived continuously by PostgreSQL with `archive_mode=on` and `archive_timeout` configured in the production compose file. The base backup plus WAL archive is the PITR chain.

The repository cannot prove a production RPO/RTO until a real managed database, backup bucket, credentials and restore target are exercised. `restore-drill.sh` and `disaster-drill.sh` produce evidence once run against that environment.
