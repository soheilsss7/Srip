import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('users')
@UseGuards(AuthGuard, AuthorizationGuard)
@RequirePermission('admin.users')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get('status') status(){ return this.service.status(); }
}
