import { Controller, Get, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SecurityService } from './security.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { SecurityGovernanceService } from './security-governance.service';

@Controller('security')
@UseGuards(AuthGuard, AuthorizationGuard)
export class SecurityController {
  constructor(private readonly security: SecurityService, private readonly authorization: AuthorizationService, private readonly governance: SecurityGovernanceService) {}
  @Get('events') @RequirePermission('security.read')
  events(@Req() req: any, @Query('take') take?: string) { return this.authorization.accessibleOrganizationIds(req.user.sub).then(ids => this.security.list(req.user.sub, ids, Number(take) || 200)); }
  @Get('governance/preflight') @RequirePermission('enterprise.security')
  governancePreflight() { return this.governance.preflight(); }

  @Get('exports') @RequirePermission('audit.read')
  exports(@Req() req: any, @Query('take') take?: string) { return this.authorization.accessibleOrganizationIds(req.user.sub).then(ids => this.security.exportHistory(req.user.sub, ids, Number(take) || 200)); }
}
