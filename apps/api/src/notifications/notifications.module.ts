import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationRealtimeService } from './notification-realtime.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationRuleEngineService } from './notification-rule-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { CanonicalBusinessAlertsService } from './canonical-business-alerts.service';
import { NotificationAlertsController } from './notification-alerts.controller';

@Global()
@Module({
  controllers: [NotificationsController, NotificationAlertsController],
  providers: [NotificationsService, NotificationRealtimeService, NotificationsGateway, NotificationRuleEngineService, CanonicalBusinessAlertsService, PrismaService],
  exports: [NotificationsService, NotificationRealtimeService, NotificationRuleEngineService, CanonicalBusinessAlertsService],
})
export class NotificationsModule {}
