import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CustomFieldsService } from './custom-fields.service';

@Controller()
@UseGuards(AuthGuard, AuthorizationGuard)
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get('custom-fields')
  @RequirePermission('admin.custom_fields')
  listDefinitions(@Req() req: any, @Query('entityType') entityType?: string, @Query('organizationId') organizationId?: string) {
    return this.service.listDefinitions(req.user.sub, entityType, organizationId);
  }

  @Post('custom-fields')
  @RequirePermission('admin.custom_fields')
  createOrUpdateDefinition(@Req() req: any, @Body() body: any) {
    return this.service.upsertDefinition(req.user.sub, body);
  }

  @Delete('custom-fields/:id')
  @RequirePermission('admin.custom_fields')
  deleteDefinition(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteDefinition(req.user.sub, id);
  }

  @Get('entities/:entityType/:entityId/custom-fields')
  @RequirePermission('entity.read')
  getEntityValues(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.getEntityValues(req.user.sub, entityType, entityId);
  }

  @Post('entities/:entityType/:entityId/custom-fields')
  @RequirePermission('entity.write')
  setEntityValues(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string, @Body() body: { values: Array<{ customFieldId: string; value: unknown }> }) {
    return this.service.setEntityValues(req.user.sub, entityType, entityId, body?.values);
  }

  @Delete('entities/:entityType/:entityId/custom-fields/:customFieldId')
  @RequirePermission('entity.write')
  removeEntityValue(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string, @Param('customFieldId') customFieldId: string) {
    return this.service.removeEntityValue(req.user.sub, entityType, entityId, customFieldId);
  }
}
