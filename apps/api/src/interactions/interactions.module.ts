import { Module } from '@nestjs/common';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { AuthGuard } from '../common/guards/auth.guard';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule], controllers: [InteractionsController], providers: [
        InteractionsService, AuthGuard
    ] })
export class InteractionsModule {
}
