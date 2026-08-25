CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

CREATE TABLE "DomainEventOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "organizationId" TEXT,
  "actorId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DomainEventOutbox_status_createdAt_idx" ON "DomainEventOutbox"("status", "createdAt");
CREATE INDEX "DomainEventOutbox_eventType_occurredAt_idx" ON "DomainEventOutbox"("eventType", "occurredAt");
CREATE INDEX "DomainEventOutbox_aggregateType_aggregateId_idx" ON "DomainEventOutbox"("aggregateType", "aggregateId");
CREATE INDEX "DomainEventOutbox_organizationId_occurredAt_idx" ON "DomainEventOutbox"("organizationId", "occurredAt");
