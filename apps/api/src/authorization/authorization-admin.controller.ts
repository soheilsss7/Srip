import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthorizationAdminService } from './authorization-admin.service';
import { UserAccessService } from './user-access.service';

@Controller('authorization')
@UseGuards(AuthGuard, AuthorizationGuard)
export class AuthorizationAdminController {
  constructor(private readonly service: AuthorizationAdminService, private readonly userAccess: UserAccessService) {}

  @Get('roles') @RequirePermission('role.manage') roles(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.listRoles(req.user.sub, organizationId); }
  @Post('roles') @RequirePermission('role.manage') createRole(@Req() req: any, @Body() body: any) { return this.service.createRole(req.user.sub, body); }
  @Put('roles/:role/permissions') @RequirePermission('role.manage') setPermissions(@Req() req: any, @Param('role') role: string, @Body() body: any) { return this.service.setRolePermissions(req.user.sub, role, body.permissions ?? []); }
  @Get('memberships') @RequirePermission('access.manage') memberships(@Req() req: any, @Query('organizationId') organizationId: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.service.listMemberships(req.user.sub, organizationId, Number(page) || 1, Number(limit) || 100); }
  @Post('memberships') @RequirePermission('access.manage') assign(@Req() req: any, @Body() body: any) { return this.service.assignMembership(req.user.sub, body); }
  @Delete('memberships/:id') @RequirePermission('access.manage') revoke(@Req() req: any, @Param('id') id: string) { return this.service.revokeMembership(req.user.sub, id); }
  @Post('evaluate') @RequirePermission('access.manage') evaluate(@Req() req: any, @Body() body: any) { return this.service.evaluate(req.user.sub, body.permission, body.context ?? {}); }

  /* ---- فاز ۴ (ADR-0008): RBAC سه‌بعدی scope × accessLevel × functionalRole ---- */
  @Get('user-access') @RequirePermission('access.manage')
  getUserAccess(@Req() req: any, @Query('userId') userId: string) { return this.userAccess.get(req.user.sub === userId ? req.user.sub : userId); }
  @Post('user-access/migrate') @RequirePermission('access.manage')
  migrateUserAccess(@Req() req: any, @Body() body: any) {
    return body?.userId ? this.userAccess.migrateRoleToAccess(body.userId) : this.userAccess.migrateAll();
  }
}
