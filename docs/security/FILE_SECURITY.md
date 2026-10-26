# File Security — Phase 24

Upload controls:
- MIME validation
- Extension allowlist
- Content/magic-byte validation
- Maximum size
- SHA-256 content hash
- Random/non-user-controlled storage key
- Private object storage
- Quarantine before release
- ClamAV/clamd malware scanning when FILE_SCAN_REQUIRED=true
- Fail closed when required scanner is unavailable
- Encrypted object storage via S3 server-side encryption
- Signed download URLs with short expiration
- Download forced as attachment
- Authorization before metadata/read/download
- Audit-compatible document access path

A file is downloadable only after a CLEAN scan, or NOT_REQUIRED when scanning is explicitly disabled for a controlled non-production environment.
