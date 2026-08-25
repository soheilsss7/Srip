import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { SearchModule } from '../search/search.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommitmentsModule } from '../commitments/commitments.module';
import { JobService } from './job.service';
import { JobWorker } from './job.worker';
import { QueueService } from './queue.service';
import { forwardRef } from '@nestjs/common';
import { PrivacyModule } from '../privacy/privacy.module';

@Module({
  imports: [ConfigModule, AiModule, DocumentsModule, IntegrationsModule, NotificationsModule, RecommendationsModule, MeetingsModule, SearchModule, AnalyticsModule, CommitmentsModule, forwardRef(() => PrivacyModule)],
  providers: [QueueService, JobService, JobWorker],
  exports: [QueueService, JobService],
})
export class JobsModule {}
