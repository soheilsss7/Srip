import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { EntityScoreService } from './entity-score.service';

@Controller('entity-scores')
@UseGuards(AuthGuard, AuthorizationGuard)
export class EntityScoresController {
  constructor(private readonly service: EntityScoreService) {}

  @Get() @RequirePermission('relationship.read')
  list(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.list(req.user.sub, Number(page) || 1, Math.min(200, Number(pageSize) || 50));
  }

  @Get(':entityType/:entityId') @RequirePermission('relationship.read')
  get(@Req() req: any, @Param('entityType') entityType: 'RELATIONSHIP' | 'PUBLIC_GROUP' | 'PUBLIC_MEMBER', @Param('entityId') entityId: string) {
    return this.service.get(req.user.sub, entityType, entityId);
  }

  @Post('recalculate') @RequirePermission('relationship.write')
  recalculate(@Req() req: any, @Body() body: { entityType: 'RELATIONSHIP' | 'PUBLIC_GROUP' | 'PUBLIC_MEMBER'; entityId: string }) {
    return this.service.calculate(req.user.sub, body.entityType, body.entityId);
  }
}
