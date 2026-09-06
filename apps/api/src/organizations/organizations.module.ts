import { Module } from '@nestjs/common';
import { CriteriaModule } from '../criteria/criteria.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
@Module({ imports: [PermissionsModule, AuditModule, DataLifecycleModule, CriteriaModule], controllers: [OrganizationsController], providers: [
        OrganizationsService
    ] })
export class OrganizationsModule {
}
