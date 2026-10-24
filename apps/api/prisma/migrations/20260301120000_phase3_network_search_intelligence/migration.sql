ALTER TABLE "AnalyticsEvent" ADD COLUMN "domainEventId" TEXT;
CREATE UNIQUE INDEX "AnalyticsEvent_domainEventId_key" ON "AnalyticsEvent"("domainEventId");
