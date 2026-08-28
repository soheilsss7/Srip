import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(AuthGuard, AuthorizationGuard)
@RequirePermission('enterprise.admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('overview') overview(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.overview(req.user.sub, organizationId); }

  @Get('users') users(@Req() req: any, @Query('organizationId') organizationId?: string, @Query('search') search?: string) { return this.service.listUsers(req.user.sub, organizationId, search); }
  @Patch('users/:id/active') setUserActive(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.setUserActive(req.user.sub, id, !!body.active); }

  @Get('organizations') organizations(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listOrganizations(req.user.sub, organizationId); }
  @Patch('organizations/:id/active') setOrganizationActive(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.setOrganizationActive(req.user.sub, id, !!body.active); }

  @Get('roles') roles(@Req() req: any) { return this.service.listRoles(req.user.sub); }
  @Get('permissions') permissions(@Req() req: any) { return this.service.listPermissions(req.user.sub); }

  @Get('tags') tags(@Req() req: any, @Query('search') search?: string) { return this.service.listTags(req.user.sub, search); }
  @Post('tags') createTag(@Req() req: any, @Body() body: any) { return this.service.upsertTag(req.user.sub, body.name); }
  @Patch('tags/:id') renameTag(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.renameTag(req.user.sub, id, String(body.name ?? '').trim()); }
  @Delete('tags/:id') deleteTag(@Req() req: any, @Param('id') id: string) { return this.service.deleteTag(req.user.sub, id); }

  @Get('relationship-types') relationshipTypes(@Req() req: any) { return this.service.listRelationshipTypes(req.user.sub); }
  @Post('relationship-types') upsertRelationshipType(@Req() req: any, @Body() body: any) { return this.service.upsertRelationshipType(req.user.sub, body); }

  @Get('interaction-types') interactionTypes(@Req() req: any) { return this.service.listInteractionTypes(req.user.sub); }
  @Patch('interaction-types/:key') updateInteractionType(@Req() req: any, @Param('key') key: string, @Body() body: any) { return this.service.updateInteractionType(req.user.sub, key, body); }

  @Get('workflows') workflows(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listWorkflows(req.user.sub, organizationId); }
  @Get('integrations') integrations(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listIntegrations(req.user.sub, organizationId); }
  @Get('audit') audit(@Req() req: any, @Query('organizationId') organizationId?: string, @Query('entityType') entityType?: string) { return this.service.listAudit(req.user.sub, organizationId, entityType); }

  @Get('custom-fields') customFields(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listCustomFields(req.user.sub, organizationId); }
  @Post('custom-fields') upsertCustomField(@Req() req: any, @Body() body: any) { return this.service.upsertCustomField(req.user.sub, body); }

  @Get('scoring-rules') scoringRules(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listScoringRules(req.user.sub, organizationId); }
  @Post('scoring-rules') upsertScoringRule(@Req() req: any, @Body() body: any) { return this.service.upsertScoringRule(req.user.sub, body); }

  @Get('notification-rules') notificationRules(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listNotificationRules(req.user.sub, organizationId); }
  @Post('notification-rules') upsertNotificationRule(@Req() req: any, @Body() body: any) { return this.service.upsertNotificationRule(req.user.sub, body); }

  @Get('ai-settings') aiSettings(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listAiSettings(req.user.sub, organizationId); }
  @Post('ai-settings') upsertAiSetting(@Req() req: any, @Body() body: any) { return this.service.upsertAiSetting(req.user.sub, body); }
}
