import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { CoreDomainController } from './core-domain.controller';
@Module({ imports: [PermissionsModule, AuditModule], controllers: [CoreDomainController], providers: [] })
export class CoreDomainModule {
}
