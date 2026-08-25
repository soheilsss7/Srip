import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TagsService } from './tags.service';

@Controller()
@UseGuards(AuthGuard, AuthorizationGuard)
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Post('tags') @RequirePermission('tag.write')
  create(@Req() req: any, @Body() body: { name: string }) { return this.service.create(req.user.sub, body); }

  @Get('tags') @RequirePermission('tag.read')
  list(@Req() req: any, @Query('q') q?: string, @Query('take') take?: string, @Query('skip') skip?: string) {
    return this.service.list(req.user.sub, { q, take, skip });
  }

  @Patch('tags/:id') @RequirePermission('tag.write')
  update(@Req() req: any, @Param('id') id: string, @Body() body: { name: string }) { return this.service.update(req.user.sub, id, body); }

  @Delete('tags/:id') @RequirePermission('tag.write')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.sub, id); }

  @Get('entities/:entityType/:entityId/tags') @RequirePermission('tag.read')
  getEntityTags(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.getEntityTags(req.user.sub, entityType, entityId);
  }

  @Post('entities/:entityType/:entityId/tags') @RequirePermission('tag.write')
  assign(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string, @Body() body: { tagId: string; organizationId?: string }) {
    return this.service.assign(req.user.sub, entityType, entityId, body);
  }

  @Delete('entities/:entityType/:entityId/tags/:tagId') @RequirePermission('tag.write')
  unassign(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string, @Param('tagId') tagId: string) {
    return this.service.removeAssignment(req.user.sub, entityType, entityId, tagId);
  }
}
