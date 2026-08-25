-- PHASE AP: allow idempotent replay of binary export responses without weakening
-- the canonical IdempotencyRecord contract.
ALTER TABLE "IdempotencyRecord" ADD COLUMN "responseBodyBase64" TEXT;
