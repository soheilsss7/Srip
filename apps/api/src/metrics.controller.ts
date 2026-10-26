import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AuthGuard } from './common/guards/auth.guard';
import { AuthorizationGuard } from './common/guards/authorization.guard';
import { RequirePermission } from './common/decorators/require-permission.decorator';
import { InternalMetricsGuard } from './common/guards/internal-metrics.guard';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  /**
   * Prometheus scrape endpoint.
   * It is intentionally not bearer-authenticated because Prometheus scrapers
   * normally do not carry an application user session. Access is restricted
   * to explicitly configured internal CIDRs by InternalMetricsGuard.
   */
  @Get()
  @UseGuards(InternalMetricsGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus() {
    return this.metrics.prometheus();
  }

  /**
   * Management/diagnostic endpoints require both an authenticated session
   * and the dedicated metrics.read permission.
   */
  @Get('summary')
  @UseGuards(AuthGuard, AuthorizationGuard)
  @RequirePermission('metrics.read')
  summary() {
    return this.metrics.snapshot();
  }

  @Get('api-latency')
  @UseGuards(AuthGuard, AuthorizationGuard)
  @RequirePermission('metrics.read')
  apiLatency() {
    return this.metrics.snapshot().apiLatency;
  }

  @Get('db-latency')
  @UseGuards(AuthGuard, AuthorizationGuard)
  @RequirePermission('metrics.read')
  dbLatency() {
    return this.metrics.snapshot().dbLatency;
  }

  @Get('ai')
  @UseGuards(AuthGuard, AuthorizationGuard)
  @RequirePermission('metrics.read')
  ai() {
    return this.metrics.snapshot().ai;
  }

  @Get('storage')
  @UseGuards(AuthGuard, AuthorizationGuard)
  @RequirePermission('metrics.read')
  storage() {
    return this.metrics.snapshot().storage;
  }
}
