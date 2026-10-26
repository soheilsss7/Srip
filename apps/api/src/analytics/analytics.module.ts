import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRecommendationListener } from './analytics-recommendation.listener';

@Module({
  imports: [PermissionsModule, EventBusModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRecommendationListener],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
