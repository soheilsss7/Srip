import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule], controllers: [MeetingsController], providers: [
        MeetingsService, AuthGuard
    ], exports: [MeetingsService] })
export class MeetingsModule {
}
