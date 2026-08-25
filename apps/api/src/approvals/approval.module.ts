import { Module } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusModule } from '../event-bus/event-bus.module';

@Module({
  imports: [PermissionsModule, AuditModule, DataLifecycleModule, EventBusModule],
  controllers: [ApprovalController],
  providers: [ApprovalService, PrismaService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
