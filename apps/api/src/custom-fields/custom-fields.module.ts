import { Module } from '@nestjs/common';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { AuditService } from '../audit/audit.service';
@Module({ controllers: [CustomFieldsController], providers: [
        CustomFieldsService, AuditService
    ], exports: [CustomFieldsService] })
export class CustomFieldsModule {
}
