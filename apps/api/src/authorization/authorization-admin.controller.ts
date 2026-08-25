import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthorizationAdminService } from './authorization-admin.service';

@Controller('authorization')
@UseGuards(AuthGuard, AuthorizationGuard)
export class AuthorizationAdminController {
  constructor(private readonly service: AuthorizationAdminService) {}

  @Get('roles') @RequirePermission('role.manage') roles(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listRoles(req.user.sub, organizationId); }
  @Post('roles') @RequirePermission('role.manage') createRole(@Req() req: any, @Body() body: any) { return this.service.createRole(req.user.sub, body); }
  @Put('roles/:role/permissions') @RequirePermission('role.manage') setPermissions(@Req() req: any, @Param('role') role: string, @Body() body: any) { return this.service.setRolePermissions(req.user.sub, role, body.permissions ?? []); }
  @Get('memberships') @RequirePermission('access.manage') memberships(@Req() req: any, @Query('organizationId') organizationId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.listMemberships(req.user.sub, organizationId, Number(page) || 1, Number(limit) || 100); }
  @Post('memberships') @RequirePermission('access.manage') assign(@Req() req: any, @Body() body: any) { return this.service.assignMembership(req.user.sub, body); }
  @Delete('memberships/:id') @RequirePermission('access.manage') revoke(@Req() req: any, @Param('id') id: string) { return this.service.revokeMembership(req.user.sub, id); }
  @Post('evaluate') @RequirePermission('access.manage') evaluate(@Req() req: any, @Body() body: any) { return this.service.evaluate(req.user.sub, body.permission, body.context ?? {}); }
}
