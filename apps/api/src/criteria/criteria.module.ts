import { Module } from '@nestjs/common';
import { EventBusModule } from '../event-bus/event-bus.module';
import { AuditModule } from '../audit/audit.module';
import { CriteriaService } from './criteria.service';
import { CriteriaController } from './criteria.controller';

@Module({
  imports: [EventBusModule, AuditModule],
  controllers: [CriteriaController],
  providers: [CriteriaService],
  exports: [CriteriaService],
})
export class CriteriaModule {}
