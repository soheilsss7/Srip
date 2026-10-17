import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { TraceService } from './trace.service';
import { ErrorTrackingService } from './error-tracking.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({controllers:[ObservabilityController],providers:[MetricsService,TraceService,ErrorTrackingService,QueueMonitoringService],exports:[MetricsService,TraceService,ErrorTrackingService,QueueMonitoringService]})
export class ObservabilityModule {}
