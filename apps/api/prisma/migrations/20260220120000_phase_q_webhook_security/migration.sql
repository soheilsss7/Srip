CREATE TABLE "IntegrationWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "eventId" TEXT,
  "eventType" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationWebhookEvent_provider_eventId_key" ON "IntegrationWebhookEvent"("provider", "eventId");
CREATE INDEX "IntegrationWebhookEvent_provider_receivedAt_idx" ON "IntegrationWebhookEvent"("provider", "receivedAt");
CREATE INDEX "IntegrationWebhookEvent_eventType_receivedAt_idx" ON "IntegrationWebhookEvent"("eventType", "receivedAt");
CREATE INDEX "IntegrationWebhookEvent_processed_receivedAt_idx" ON "IntegrationWebhookEvent"("processed", "receivedAt");
