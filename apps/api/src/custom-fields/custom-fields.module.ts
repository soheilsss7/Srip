import { Module } from '@nestjs/common';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';

@Module({ controllers: [CustomFieldsController], providers: [CustomFieldsService, PrismaService, AuthorizationService, AuditService], exports: [CustomFieldsService] })
export class CustomFieldsModule {}
