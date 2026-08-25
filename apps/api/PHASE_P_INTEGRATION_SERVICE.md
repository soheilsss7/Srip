# PHASE P — Integration Service Token Boundary

## Contract

Provider OAuth tokens may exist in plaintext only in memory while communicating with the provider.

### Persistence boundary

`TokenSet.accessToken` and `TokenSet.refreshToken` MUST NOT be assigned directly to Prisma fields named `accessTokenEncrypted` / `refreshTokenEncrypted`.

All persistence goes through `IntegrationsService.encryptedTokenSet()` and the canonical `SecretEncryptionService.encrypt()` implementation from Phase O.

### Consumption boundary

Database values are encrypted envelopes. They MUST be decrypted with `SecretEncryptionService.decrypt()` immediately before being passed to an integration provider.

### Callback

OAuth callback:

Provider -> TokenSet -> encryptTokenSet -> Prisma transaction -> Audit

### Refresh

Encrypted refresh token -> decrypt -> provider refresh -> new TokenSet -> encryptTokenSet -> Prisma transaction -> Audit

### Disconnect

Disconnect clears both encrypted token fields. No plaintext token is written to the database.

## Verification

Run:

`npm run verify:phase-p-integration-service`

The verification checks the source-level persistence and consumption contract and fails on known plaintext persistence patterns.
