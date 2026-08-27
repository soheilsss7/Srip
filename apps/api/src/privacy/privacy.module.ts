import { Module, forwardRef } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { JobsModule } from '../jobs/jobs.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { AuditService } from '../audit/audit.service';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
@Module({ imports: [DataLifecycleModule, DocumentsModule, forwardRef(() => JobsModule)], controllers: [PrivacyController], providers: [
        PrivacyService, AuthorizationGuard, AuditService
    ], exports: [PrivacyService] })
export class PrivacyModule {
}
