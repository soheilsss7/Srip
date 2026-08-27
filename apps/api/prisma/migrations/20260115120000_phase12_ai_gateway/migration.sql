CREATE TABLE "AiPromptVersion" (
 "id" TEXT NOT NULL, "key" TEXT NOT NULL, "version" INTEGER NOT NULL, "template" TEXT NOT NULL, "model" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AiPromptVersion_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AiPromptVersion_key_version_key" ON "AiPromptVersion"("key","version");
CREATE INDEX "AiPromptVersion_key_status_idx" ON "AiPromptVersion"("key","status");
CREATE TABLE "AiDocumentChunk" (
 "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "organizationId" TEXT, "chunkIndex" INTEGER NOT NULL, "content" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "embedding" JSONB, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AiDocumentChunk_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AiDocumentChunk_documentId_chunkIndex_key" ON "AiDocumentChunk"("documentId","chunkIndex");
CREATE INDEX "AiDocumentChunk_organizationId_createdAt_idx" ON "AiDocumentChunk"("organizationId","createdAt");
ALTER TABLE "AiDocumentChunk" ADD CONSTRAINT "AiDocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "AiUsageEvent" (
 "id" TEXT NOT NULL, "userId" TEXT, "organizationId" TEXT, "intent" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT, "inputTokens" INTEGER NOT NULL DEFAULT 0, "outputTokens" INTEGER NOT NULL DEFAULT 0, "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0, "latencyMs" INTEGER NOT NULL DEFAULT 0, "success" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "AiUsageEvent_organizationId_createdAt_idx" ON "AiUsageEvent"("organizationId","createdAt");
CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId","createdAt");
