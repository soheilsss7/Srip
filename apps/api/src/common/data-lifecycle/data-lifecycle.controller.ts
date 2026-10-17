import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { AuthorizationGuard } from '../guards/authorization.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { DataLifecycleService } from './data-lifecycle.service';

@Controller('data-lifecycle')
@UseGuards(AuthGuard, AuthorizationGuard)
export class DataLifecycleController {
  constructor(private readonly lifecycle: DataLifecycleService) {}

  @Get('status')
  @RequirePermission('data.lifecycle_status')
  status(@Req() req: any) {
    return this.lifecycle.status(req.user.sub);
  }

  @Post(':entityType/:id/restore')
  @RequirePermission('data.restore')
  restore(@Req() req: any, @Param('entityType') entityType: string, @Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.lifecycle.restore(req.user.sub, entityType, id, body?.reason);
  }

  @Post(':entityType/:id/permanent-delete')
  @RequirePermission('data.permanent_delete')
  request(@Req() req: any, @Param('entityType') entityType: string, @Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.lifecycle.requestPermanentDelete(req.user.sub, entityType, id, body?.reason);
  }
}
