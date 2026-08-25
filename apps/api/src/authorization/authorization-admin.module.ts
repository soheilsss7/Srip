import { Module } from '@nestjs/common';
import { AuthorizationAdminController } from './authorization-admin.controller';
import { AuthorizationAdminService } from './authorization-admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [AuthorizationAdminController], providers: [AuthorizationAdminService, PrismaService, AuthorizationService, AuditService], exports: [AuthorizationAdminService] })
export class AuthorizationAdminModule {}
