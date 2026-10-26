import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AlertService } from './alert.service';
import { AlertsController } from './alerts.controller';

@Module({
  imports: [AuditModule],
  controllers: [AlertsController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertsModule {}
