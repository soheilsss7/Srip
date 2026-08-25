import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { InteractionKind, Priority } from '@prisma/client';
import { InteractionsService } from './interactions.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class InteractionDto {
  @IsEnum(InteractionKind) type!: InteractionKind;
  @IsString() subject!: string;
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() outcome?: string;
  @IsOptional() @IsInt() @Min(1) durationMinutes?: number;
  @IsOptional() @IsBoolean() followUpRequired?: boolean;
  @ValidateIf(o => o.followUpRequired === true) @IsDateString() followUpAt?: string;
  @IsOptional() @IsEnum(Priority) importance?: Priority;
  @IsOptional() @IsInt() @Min(-1) @Max(1) sentiment?: number;
  @IsOptional() @IsDateString() occurredAt?: string;
  @IsOptional() @IsString() relationshipId?: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsString() personId?: string;
}

@Controller('interactions')
@UseGuards(AuthGuard, AuthorizationGuard)
export class InteractionsController {
  constructor(private readonly service: InteractionsService) {}
  @Get() @RequirePermission('interaction.read') list(@Req() req: any, @Query('relationshipId') relationshipId?: string, @Query('followUpOnly') followUpOnly?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.service.list(req.user.sub, relationshipId, followUpOnly === 'true', page, pageSize); }
  @Get('timeline/:relationshipId') @RequirePermission('interaction.read') timeline(@Req() req: any, @Param('relationshipId') relationshipId: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.service.timeline(req.user.sub, relationshipId, page, pageSize); }
  @Get(':id') @RequirePermission('interaction.read') get(@Req() req: any, @Param('id') id: string) { return this.service.get(req.user.sub, id); }
  @Post() @RequirePermission('interaction.write') create(@Req() req: any, @Body() dto: InteractionDto) { return this.service.create(req.user.sub, dto); }
  @Patch(':id') @RequirePermission('interaction.write') update(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<InteractionDto>) { return this.service.update(req.user.sub, id, dto); }
  @Delete(':id') @RequirePermission('interaction.write') remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user.sub, id); }
}
