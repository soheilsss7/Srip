import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { InternalMetricsGuard } from '../common/guards/internal-metrics.guard';

@Controller('observability')
@UseGuards(InternalMetricsGuard)
export class ObservabilityController {
  constructor(private readonly metrics: MetricsService, private readonly queue: QueueMonitoringService) {}

  @Get('summary') summary(){ return this.metrics.snapshot(); }
  @Get('queue') async queueSnapshot(){ return this.queue.snapshot(); }
  @Get('metrics') @Header('Content-Type','text/plain; version=0.0.4') metricsText(){ return this.metrics.prometheus(); }
}
