import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ApprovalService } from './approval.service';

@Controller('approvals')
@UseGuards(AuthGuard, AuthorizationGuard)
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get() @RequirePermission('approval.read')
  list(@Req() req: any, @Query('status') status = 'PENDING') {
    return this.approvals.list(req.user.sub, status);
  }

  @Post() @RequirePermission('approval.request')
  request(@Req() req: any, @Body() body: any) {
    return this.approvals.request(req.user.sub, body);
  }

  @Post(':id/approve') @RequirePermission('approval.decide')
  approve(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.approvals.approve(req.user.sub, id, body?.reason ?? 'approved');
  }

  @Post(':id/reject') @RequirePermission('approval.decide')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.approvals.reject(req.user.sub, id, body?.reason ?? 'rejected');
  }
}
