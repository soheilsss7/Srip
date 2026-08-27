import { Module } from '@nestjs/common';
import { AuthorizationAdminController } from './authorization-admin.controller';
import { AuthorizationAdminService } from './authorization-admin.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [AuthorizationAdminController], providers: [
        AuthorizationAdminService, AuditService
    ], exports: [AuthorizationAdminService] })
export class AuthorizationAdminModule {
}
