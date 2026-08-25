import { Module } from '@nestjs/common';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [EnterpriseController], providers: [EnterpriseService, PrismaService, AuthorizationService, AuditService], exports: [EnterpriseService] })
export class EnterpriseModule {}
