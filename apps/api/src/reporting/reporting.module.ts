import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { NetworkModule } from '../network/network.module';
import { ApprovalModule } from '../approvals/approval.module';
@Module({ imports: [PermissionsModule, AuditModule, NetworkModule, ApprovalModule], controllers: [ReportingController], providers: [
        ReportingService
    ], exports: [ReportingService] })
export class ReportingModule {
}
