import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule], controllers: [ProjectsController], providers: [
        ProjectsService, AuthGuard
    ] })
export class ProjectsModule {
}
