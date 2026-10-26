import { Controller, Get, Param, Post, Req, UseGuards, Delete } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(AuthGuard, AuthorizationGuard)
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}
  @Get() list(@Req() req: any) { return this.sessions.list(req.user.sub); }
  @Delete(':id') revoke(@Req() req: any, @Param('id') id: string) { return this.sessions.revokeOwned(req.user.sub, id); }
  @Post('revoke-all') revokeAll(@Req() req: any) { return this.sessions.revokeAll(req.user.sub); }
  @Post('revoke-all-except-current') revokeAllExcept(@Req() req: any) { return this.sessions.revokeAllExcept(req.user.sub, req.user.sid); }
  @Post('admin/:userId/:sessionId/revoke') @RequirePermission('session.admin.revoke') adminRevoke(@Param('sessionId') sessionId: string) { return this.sessions.revokeById(sessionId); }
}
