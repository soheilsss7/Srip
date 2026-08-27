import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { EnterpriseService } from './enterprise.service';

@Controller('enterprise')
@UseGuards(AuthGuard, AuthorizationGuard)
export class EnterpriseController {
  constructor(private readonly service: EnterpriseService) {}
  @Get('overview') @RequirePermission('enterprise.read') overview(@Req() r: any, @Query('organizationId') organizationId?: string) { return this.service.overview(r.user.sub, organizationId); }
  @Get('policies') @RequirePermission('enterprise.read') policies(@Req() r: any, @Query('organizationId') organizationId?: string) { return this.service.policies(r.user.sub, organizationId); }
  @Post('policies') @RequirePermission('enterprise.admin') policy(@Req() r: any, @Body() body: any) { return this.service.upsertPolicy(r.user.sub, body); }
  @Delete('policies/:id') @RequirePermission('enterprise.admin') deletePolicy(@Req() r: any, @Param('id') id: string) { return this.service.deletePolicy(r.user.sub, id); }
  @Get('exports') @RequirePermission('enterprise.read') exports(@Req() r: any, @Query('organizationId') organizationId?: string) { return this.service.exports(r.user.sub, organizationId); }
  @Post('exports') @RequirePermission('enterprise.export') createExport(@Req() r: any, @Body() body: any) { return this.service.createExportRecord(r.user.sub, body); }
  @Get('security-events') @RequirePermission('enterprise.security') security(@Req() r: any, @Query('organizationId') organizationId?: string) { return this.service.securityEvents(r.user.sub, organizationId); }
  @Get('feature-flags') @RequirePermission('feature_flag.read') flags(@Req() r: any, @Query('organizationId') organizationId?: string) { return this.service.flags(r.user.sub, organizationId); }
  @Post('feature-flags') @RequirePermission('feature_flag.write') flag(@Req() r: any, @Body() body: any) { return this.service.setFlag(r.user.sub, body); }
}
