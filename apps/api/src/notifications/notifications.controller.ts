import { BadGatewayException, BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../common/guards/auth.guard';

class PushSubscriptionDto {
  @IsString() endpoint!: string;
  @IsObject() keys!: { p256dh: string; auth: string };
}
class UnsubscribeDto { @IsString() endpoint!: string; }

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('status') status() { return this.service.status(); }
  @Get() list(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string, @Query('unreadOnly') unreadOnly?: string, @Query('groupKey') groupKey?: string) { return this.service.list(req.user.sub, { page: Number(page), limit: Number(limit), unreadOnly: unreadOnly === 'true', groupKey }); }
  @Get('unread-count') unread(@Req() req: any) { return this.service.unreadCount(req.user.sub); }
  @Patch(':id/read') read(@Param('id') id: string, @Req() req: any) { return this.service.markRead(req.user.sub, id); }
  @Patch('read-all') readAll(@Req() req: any) { return this.service.markAllRead(req.user.sub); }
  @Get('preferences') preferences(@Req() req: any) { return this.service.preferences(req.user.sub); }
  @Patch('preferences') updatePreferences(@Req() req: any, @Body() b: any) { return this.service.updatePreferences(req.user.sub, b); }
  @Post('digest/:cadence') digest(@Param('cadence') cadence: string, @Req() req: any) { if (cadence !== 'DAILY' && cadence !== 'WEEKLY') throw new BadRequestException('cadence must be DAILY or WEEKLY'); return this.service.dispatchDigest(req.user.sub, cadence as 'DAILY'|'WEEKLY'); }
  @Get('delivery-log') deliveryLog(@Req() req: any) { return this.service.deliveryLog(req.user.sub); }
  @Post('push-subscriptions') subscribe(@Req() req: any, @Body() dto: PushSubscriptionDto) { return this.service.registerPushSubscription(req.user.sub, dto, req.headers['user-agent']); }
  @Delete('push-subscriptions') unsubscribe(@Req() req: any, @Body() dto: UnsubscribeDto) { return this.service.unregisterPushSubscription(req.user.sub, dto.endpoint); }
}
