-- Phase 26: Backend completion (meetings follow-up, scheduled overdue sweep,
-- scheduled analytics recompute, notification delivery log).
--
-- 1) System actor user: allows scheduled/background jobs (no human session)
--    to write valid, FK-safe AuditLog / Notification rows instead of using
--    a placeholder string that would violate the foreign key constraint.
INSERT INTO "User" ("id", "email", "name", "passwordHash", "isActive", "emailVerifiedAt", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000099', 'system@srip.internal', 'SRIP Scheduled Jobs', NULL, false, NOW(), NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 2) NotificationDeliveryLog: real, queryable record of every attempted
--    Email/Push delivery (accepted or not, which provider, and why),
--    so "did the notification actually go out" is answerable from the DB
--    instead of being invisible (previously the Noop provider silently
--    discarded this information).
CREATE TABLE "NotificationDeliveryLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "title" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDeliveryLog_userId_createdAt_idx" ON "NotificationDeliveryLog"("userId", "createdAt");
CREATE INDEX "NotificationDeliveryLog_channel_accepted_idx" ON "NotificationDeliveryLog"("channel", "accepted");

ALTER TABLE "NotificationDeliveryLog" ADD CONSTRAINT "NotificationDeliveryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) PushSubscription: storage for Web Push registrations (W3C Push API),
--    required for WebPushNotificationProvider to have a real destination.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Meeting.followUpCandidates: persisted output of the deterministic
--    action-item extraction (see MeetingsService.extractActionItems), so a
--    background job can (re)compute candidates for a meeting whose
--    notes/transcript were added or edited after the meeting was finalized,
--    without needing to recompute synchronously on every read.
ALTER TABLE "Meeting" ADD COLUMN "followUpCandidates" JSONB;
