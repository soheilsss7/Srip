import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AlertModule as AlertModuleEnum, AlertSeverity } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AlertService } from './alert.service';

@Controller('alerts')
@UseGuards(AuthGuard, AuthorizationGuard)
export class AlertsController {
  constructor(private readonly service: AlertService) {}

  @Get() @RequirePermission('dashboard.read')
  list(
    @Req() req: any,
    @Query('module') module?: AlertModuleEnum,
    @Query('severity') severity?: AlertSeverity,
    @Query('open') open?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(req.user.sub, {
      module,
      severity,
      open: open === undefined ? true : open !== 'false',
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 100,
    });
  }

  @Post('detect') @RequirePermission('dashboard.read')
  detect(@Req() req: any) {
    return this.service.detectAll(req.user.sub);
  }

  @Post(':id/resolve') @RequirePermission('dashboard.read')
  resolve(@Req() req: any, @Param('id') id: string) {
    return this.service.resolve(req.user.sub, id);
  }
}
