import { Module } from '@nestjs/common';
import { DataManagementController } from './data-management.controller';
import { DataImportService } from './data-import.service';
import { DataQualityService } from './data-quality.service';
import { AuditService } from '../audit/audit.service';
import { JobsModule } from '../jobs/jobs.module';
import { DataImportWorker } from './data-import.worker';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { ApprovalModule } from '../approvals/approval.module';
import { EventBusModule } from '../event-bus/event-bus.module';
@Module({ imports: [ApprovalModule, EventBusModule, JobsModule], controllers: [DataManagementController], providers: [
        DataImportService, DataQualityService, DuplicateDetectionService, AuditService, DataImportWorker
    ], exports: [DataImportService, DataQualityService] })
export class DataManagementModule {
}
