import { Module } from '@nestjs/common';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [EnterpriseController], providers: [
        EnterpriseService, AuditService
    ], exports: [EnterpriseService] })
export class EnterpriseModule {
}
