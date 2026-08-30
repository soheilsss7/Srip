import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ActionStatus, Priority } from '@prisma/client';
import { ActionsService } from './actions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class ActionDto {
  @IsString() @MinLength(2) title!: string;
  @IsEnum(ActionStatus) @IsOptional() status?: ActionStatus;
  @IsEnum(Priority) @IsOptional() priority?: Priority;
  @IsDateString() @IsOptional() dueAt?: string;
  @IsDateString() @IsOptional() reminderAt?: string;
  @IsDateString() @IsOptional() completionAt?: string;
  @IsString() @IsOptional() outcome?: string;
  @IsString() @IsOptional() organizationId?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @IsOptional() relationshipId?: string;
  @IsString() @IsOptional() meetingId?: string;
  @IsString() @IsOptional() personId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() recommendationId?: string;
}

class UpdateActionDto {
  @IsString() @MinLength(2) @IsOptional() title?: string;
  @IsEnum(ActionStatus) @IsOptional() status?: ActionStatus;
  @IsEnum(Priority) @IsOptional() priority?: Priority;
  @IsDateString() @IsOptional() dueAt?: string;
  @IsDateString() @IsOptional() reminderAt?: string;
  @IsDateString() @IsOptional() completionAt?: string;
  @IsString() @IsOptional() outcome?: string;
  @IsString() @IsOptional() organizationId?: string;
  @IsString() @IsOptional() ownerId?: string;
  @IsString() @IsOptional() relationshipId?: string;
  @IsString() @IsOptional() meetingId?: string;
  @IsString() @IsOptional() personId?: string;
  @IsString() @IsOptional() projectId?: string;
  @IsString() @IsOptional() recommendationId?: string;
}

@Controller('actions')
@UseGuards(AuthGuard, AuthorizationGuard)
export class ActionsController {
  constructor(private readonly s: ActionsService) {}
  @Get() @RequirePermission('action.read') list(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('organizationId') organizationId?: string, @Query('search') search?: string) { return this.s.list(req.user.sub, page, pageSize, organizationId, search); }
  @Get('follow-up/overdue') @RequirePermission('action.read') overdue(@Req() req: any, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('organizationId') organizationId?: string) { return this.s.listOverdue(req.user.sub, page, pageSize, organizationId); }
  @Get('follow-up/due-soon') @RequirePermission('action.read') dueSoon(@Req() req: any, @Query('days') days?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string, @Query('organizationId') organizationId?: string) { return this.s.listDueSoon(req.user.sub, days ? Number(days) : undefined, page, pageSize, organizationId); }
  @Get(':id') @RequirePermission('action.read') get(@Param('id') id: string, @Req() req: any) { return this.s.get(req.user.sub, id); }
  @Post() @RequirePermission('action.write') create(@Body() d: ActionDto, @Req() req: any) { return this.s.create(req.user.sub, d); }
  @Patch(':id') @RequirePermission('action.write') update(@Param('id') id: string, @Body() d: UpdateActionDto, @Req() req: any) { return this.s.update(req.user.sub, id, d); }
  @Post(':id/dependencies/:dependsOnActionId') @RequirePermission('action.write') addDependency(@Param('id') id: string, @Param('dependsOnActionId') dependsOnActionId: string, @Req() req: any) { return this.s.addDependency(req.user.sub, id, dependsOnActionId); }
  @Delete(':id/dependencies/:dependsOnActionId') @RequirePermission('action.write') removeDependency(@Param('id') id: string, @Param('dependsOnActionId') dependsOnActionId: string, @Req() req: any) { return this.s.removeDependency(req.user.sub, id, dependsOnActionId); }
  @Delete(':id') @RequirePermission('action.write') remove(@Param('id') id: string, @Req() req: any) { return this.s.remove(req.user.sub, id); }
}
