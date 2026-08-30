import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { MeetingStatus, Priority } from '@prisma/client';
import { MeetingsService } from './meetings.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class MeetingDecisionDto {
  @IsString() @MinLength(1) text!: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
class MeetingDto {
  @IsString() @MinLength(1) title!: string;
  @IsDateString() startAt!: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsEnum(MeetingStatus) status?: MeetingStatus;
  @IsOptional() @IsString() @MaxLength(100_000) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MeetingDecisionDto) decisions?: MeetingDecisionDto[];
  @IsOptional() @IsString() recordingReference?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetingUrl?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() relationshipId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) participantPersonIds?: string[];
}
class MeetingOutcomeDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MeetingDecisionDto) decisions?: MeetingDecisionDto[];
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @IsString() preMeetingBrief?: string;
}
class UpdateMeetingDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @IsString() agenda?: string;
  @IsOptional() @IsEnum(MeetingStatus) status?: MeetingStatus;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsString() transcript?: string;
  @IsOptional() @IsString() preMeetingBrief?: string;
  @IsOptional() @IsString() recordingReference?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() meetingUrl?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() relationshipId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MeetingDecisionDto) decisions?: MeetingDecisionDto[];
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) participantPersonIds?: string[];
}
class ParticipantDto { @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) personIds!: string[]; }
class ActionItemInputDto {
  @IsString() @MinLength(1) @MaxLength(500) title!: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsBoolean() asCommitment?: boolean;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() @MaxLength(100_000) description?: string;
}
class ApplyActionItemsDto { @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ActionItemInputDto) items!: ActionItemInputDto[]; }
class ExtractActionItemsDto { @IsOptional() @IsString() @MaxLength(100_000) text?: string; }

@Controller('meetings')
@UseGuards(AuthGuard, AuthorizationGuard)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}
  @Get() @RequirePermission('meeting.read') list(@Req() req: any, @Query('relationshipId') relationshipId?: string, @Query('organizationId') organizationId?: string, @Query('upcoming') upcoming?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('search') search?: string) { return this.service.list(req.user.sub, relationshipId, upcoming === 'true', page, pageSize, organizationId, search); }
  @Get(':id') @RequirePermission('meeting.read') get(@Req() req: any, @Param('id') id: string) { return this.service.get(req.user.sub, id); }
  @Post() @RequirePermission('meeting.write') create(@Req() req: any, @Body() dto: MeetingDto) { return this.service.create(req.user.sub, dto); }
  @Patch(':id') @RequirePermission('meeting.write') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateMeetingDto) { return this.service.update(req.user.sub, id, dto); }
  @Post(':id/outcome') @RequirePermission('meeting.write') outcome(@Req() req: any, @Param('id') id: string, @Body() dto: MeetingOutcomeDto) { return this.service.complete(req.user.sub, id, dto); }
  @Put(':id/participants') @RequirePermission('meeting.write') participants(@Req() req: any, @Param('id') id: string, @Body() dto: ParticipantDto) { return this.service.replaceParticipants(req.user.sub, id, dto.personIds); }
  @Delete(':id') @RequirePermission('meeting.write') remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.sub, id); }

  // --- Meeting Minutes / Follow-up (deterministic, no AI dependency) ---
  @Get(':id/minutes') @RequirePermission('meeting.read') minutes(@Req() req: any, @Param('id') id: string) { return this.service.minutes(req.user.sub, id); }
  @Post(':id/finalize') @RequirePermission('meeting.write') finalize(@Req() req: any, @Param('id') id: string, @Body() dto: MeetingOutcomeDto) { return this.service.finalize(req.user.sub, id, dto); }
  @Post(':id/action-items/extract') @RequirePermission('meeting.read') extractActionItems(@Req() req: any, @Param('id') id: string, @Body() dto: ExtractActionItemsDto) {
    if (dto?.text) return { meetingId: id, source: 'provided_text', candidateCount: this.service.extractActionItems(dto.text).length, candidates: this.service.extractActionItems(dto.text) };
    return this.service.extractActionItemsForMeeting(req.user.sub, id);
  }
  @Post(':id/action-items/apply') @RequirePermission('meeting.write') applyActionItems(@Req() req: any, @Param('id') id: string, @Body() dto: ApplyActionItemsDto) { return this.service.applyActionItems(req.user.sub, id, dto.items); }
  @Get('follow-ups/list') @RequirePermission('meeting.read') followUps(@Req() req: any, @Query('withinDays') withinDays?: string) { return this.service.followUps(req.user.sub, withinDays ? Number(withinDays) : undefined); }
}
