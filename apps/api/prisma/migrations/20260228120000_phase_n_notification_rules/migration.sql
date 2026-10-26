ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "notificationRuleId" TEXT;
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "eventId" TEXT;
CREATE INDEX "NotificationDeliveryLog_notificationRuleId_eventId_idx" ON "NotificationDeliveryLog"("notificationRuleId", "eventId");

CREATE TABLE "NotificationRuleDelivery" (
  "id" TEXT NOT NULL,
  "notificationRuleId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notificationId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRuleDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationRuleDelivery_notificationRuleId_eventId_userId_channel_key" ON "NotificationRuleDelivery"("notificationRuleId", "eventId", "userId", "channel");
CREATE INDEX "NotificationRuleDelivery_eventId_status_idx" ON "NotificationRuleDelivery"("eventId", "status");
CREATE INDEX "NotificationRuleDelivery_userId_createdAt_idx" ON "NotificationRuleDelivery"("userId", "createdAt");

ALTER TABLE "NotificationRuleDelivery" ADD CONSTRAINT "NotificationRuleDelivery_notificationRuleId_fkey" FOREIGN KEY ("notificationRuleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRuleDelivery" ADD CONSTRAINT "NotificationRuleDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRuleDelivery" ADD CONSTRAINT "NotificationRuleDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
