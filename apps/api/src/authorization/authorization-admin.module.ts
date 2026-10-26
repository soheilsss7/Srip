import { Module } from '@nestjs/common';
import { AuthorizationAdminController } from './authorization-admin.controller';
import { AuthorizationAdminService } from './authorization-admin.service';
import { UserAccessService } from './user-access.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [AuthorizationAdminController], providers: [
        AuthorizationAdminService, AuditService, UserAccessService
    ], exports: [AuthorizationAdminService, UserAccessService] })
export class AuthorizationAdminModule {
}
