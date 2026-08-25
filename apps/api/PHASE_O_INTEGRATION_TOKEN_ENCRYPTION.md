# PHASE O — Integration Token Encryption

Integration OAuth access/refresh tokens are encrypted at rest with AES-256-GCM before they are written to `IntegrationConnection.accessTokenEncrypted` / `refreshTokenEncrypted`.

Envelope metadata:
- `version`
- `algorithm`
- `keyVersion`
- `iv`
- `authTag`
- `ciphertext`

Configuration:
- `SECRET_ENCRYPTION_KEY`: 32-byte key, supplied as 64 hex characters or base64 encoding of 32 bytes.
- `SECRET_ENCRYPTION_KEY_VERSION`: current key version; defaults to `v1`.
- Previous key versions are resolved from `SECRET_ENCRYPTION_KEY_<VERSION>` for rotation/decryption.

Never place the encryption key in source control, frontend code, logs, audit payloads, or database rows.

## Legacy plaintext migration

Run before using existing integration connections:

`npm run security:encrypt-integration-tokens`

The command encrypts any legacy plaintext token values in place, records a non-secret `TOKEN_CHANGE` audit entry, and never prints token contents.

Runtime code fails closed when a stored value is not a valid encrypted envelope; it does not silently treat plaintext as an encrypted token.
