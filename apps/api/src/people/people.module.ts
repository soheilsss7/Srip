import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule], controllers: [PeopleController], providers: [
        PeopleService, AuthGuard
    ] })
export class PeopleModule {
}
