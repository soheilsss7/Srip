import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('users')
@UseGuards(AuthGuard, AuthorizationGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('status')
  @RequirePermission('admin.users')
  status() { return this.service.status(); }

  @Get('picker')
  @RequirePermission('entity.read')
  picker(@Req() req: any, @Query('organizationId') organizationId?: string, @Query('search') search?: string) {
    return this.service.picker(req.user.sub, organizationId, search);
  }
}
