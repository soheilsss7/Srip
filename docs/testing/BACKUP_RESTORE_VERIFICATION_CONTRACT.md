# Backup / Restore Verification Contract

Checksum is not sufficient. The drill must verify encrypted backup, checksum, decryption, pg_restore archive listing, isolated restore, schema/constraint checks, representative data checks, measured RTO, and evidence JSON. Production is never restored in-place.
