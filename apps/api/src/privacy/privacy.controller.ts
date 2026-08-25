import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
@UseGuards(AuthGuard, AuthorizationGuard)
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}
  @Get('policies') @RequirePermission('privacy.read') policies(@Req() r:any){ return this.service.policies(r.user.sub); }
  @Get('consents') consents(@Req() r:any,@Query('page') page?:string,@Query('pageSize') pageSize?:string){ return this.service.consents(r.user.sub,Number(page)||1,Number(pageSize)||50); }
  @Post('consents') grant(@Req() r:any,@Body() b:any){ return this.service.grantConsent(r.user.sub,b.purpose,b.version,b.source); }
  @Post('consents/revoke') revoke(@Req() r:any,@Body() b:any){ return this.service.revokeConsent(r.user.sub,b.purpose,b.version); }
  @Get('requests') requests(@Req() r:any,@Query('page') page?:string,@Query('pageSize') pageSize?:string){ return this.service.listRequests(r.user.sub,Number(page)||1,Number(pageSize)||50); }
  @Post('requests') createRequest(@Req() r:any,@Body() b:any){ return this.service.request(r.user.sub,b.type,b.reason); }
  @Post('requests/:id/export') @RequirePermission('privacy.export') export(@Req() r:any,@Param('id') id:string){ return this.service.exportData(r.user.sub,id); }
  @Get('requests/:id/export/status') @RequirePermission('privacy.export') exportStatus(@Req() r:any,@Param('id') id:string){ return this.service.exportStatus(r.user.sub,id); }
  @Post('requests/:id/access') @RequirePermission('privacy.access') access(@Req() r:any,@Param('id') id:string){ return this.service.accessRequest(r.user.sub,id); }
  @Post('requests/:id/erase') @RequirePermission('privacy.erase') erase(@Req() r:any,@Param('id') id:string){ return this.service.eraseData(r.user.sub,id); }
  @Post('lifecycle') @RequirePermission('privacy.manage') lifecycle(@Req() r:any,@Body() b:any){ return this.service.lifecycle(r.user.sub,b.entityType,b.entityId,b.state,b.reason); }
  @Get('retention/preview') @RequirePermission('privacy.manage') preview(@Req() r:any){ return this.service.retentionPreview(r.user.sub); }
  @Post('retention/execute') @RequirePermission('privacy.manage') execute(@Req() r:any){ return this.service.retentionExecute(r.user.sub); }
  @Get('audit') @RequirePermission('privacy.audit') audit(@Req() r:any){ return this.service.privacyAudit(r.user.sub); }
}
