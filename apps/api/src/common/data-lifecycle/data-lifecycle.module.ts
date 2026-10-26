import { Module } from '@nestjs/common';
import { DataLifecycleService } from './data-lifecycle.service';
import { DataLifecycleController } from './data-lifecycle.controller';
import { PermissionsModule } from '../../permissions/permissions.module';
import { AuditModule } from '../../audit/audit.module';
@Module({ imports: [PermissionsModule, AuditModule], controllers: [DataLifecycleController], providers: [
        DataLifecycleService
    ], exports: [DataLifecycleService] })
export class DataLifecycleModule {
}
