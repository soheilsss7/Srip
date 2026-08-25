import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { CanonicalBusinessAlertsService } from './canonical-business-alerts.service';

@Controller('notifications/alerts')
@UseGuards(AuthGuard)
export class NotificationAlertsController {
  constructor(private readonly alerts: CanonicalBusinessAlertsService) {}

  @Get('catalog')
  catalog() { return this.alerts.catalog(); }

  @Get('status')
  status() { return this.alerts.status(); }
}
