import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule], controllers: [ActionsController], providers: [
        ActionsService, AuthGuard
    ] })
export class ActionsModule {
}
