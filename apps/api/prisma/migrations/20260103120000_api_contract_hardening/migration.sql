CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "userId" TEXT,
  "statusCode" INTEGER NOT NULL,
  "responseJson" JSONB,
  "responseHeaders" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IdempotencyRecord_keyHash_key" ON "IdempotencyRecord"("keyHash");
CREATE INDEX "IdempotencyRecord_userId_createdAt_idx" ON "IdempotencyRecord"("userId","createdAt");
CREATE INDEX "IdempotencyRecord_path_createdAt_idx" ON "IdempotencyRecord"("path","createdAt");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
