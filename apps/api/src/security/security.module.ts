import { Module } from '@nestjs/common';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityGovernanceService } from './security-governance.service';
@Module({ imports: [PermissionsModule, AuditModule], controllers: [SecurityController], providers: [
        SecurityService, SecurityGovernanceService
    ], exports: [SecurityService, SecurityGovernanceService] })
export class SecurityModule {
}
