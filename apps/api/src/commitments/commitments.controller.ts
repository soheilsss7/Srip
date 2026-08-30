import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CommitmentStatus } from '@prisma/client';
import { CommitmentsService } from './commitments.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
class CommitmentDto { @IsString() @MinLength(2) description!: string; @IsString() @IsOptional() source?: string; @IsString() @IsOptional() receiver?: string; @IsString() @IsOptional() risk?: string; @IsEnum(CommitmentStatus) @IsOptional() status?: CommitmentStatus; @IsDateString() @IsOptional() dueAt?: string; @IsDateString() @IsOptional() reminderAt?: string; @IsString() @IsOptional() ownerId?: string; @IsString() @IsOptional() relationshipId?: string; @IsString() @IsOptional() meetingId?: string; @IsString() @IsOptional() personId?: string; @IsString() @IsOptional() projectId?: string; @IsString() @IsOptional() recommendationId?: string; @IsString() @IsOptional() organizationId?: string; @IsOptional() evidence?: any; }
class UpdateCommitmentDto { @IsString() @MinLength(2) @IsOptional() description?: string; @IsString() @IsOptional() source?: string; @IsString() @IsOptional() receiver?: string; @IsString() @IsOptional() risk?: string; @IsEnum(CommitmentStatus) @IsOptional() status?: CommitmentStatus; @IsDateString() @IsOptional() dueAt?: string; @IsDateString() @IsOptional() reminderAt?: string; @IsString() @IsOptional() ownerId?: string; @IsString() @IsOptional() relationshipId?: string; @IsString() @IsOptional() meetingId?: string; @IsString() @IsOptional() personId?: string; @IsString() @IsOptional() projectId?: string; @IsString() @IsOptional() recommendationId?: string; @IsString() @IsOptional() organizationId?: string; @IsOptional() evidence?: any; }
@Controller('commitments') @UseGuards(AuthGuard, AuthorizationGuard) export class CommitmentsController { constructor(private readonly s: CommitmentsService) {}
  @Get() @RequirePermission('commitment.read') list(@Req() req:any,@Query('page') page?:string,@Query('pageSize') pageSize?:string,@Query('organizationId') organizationId?:string,@Query('search') search?:string){return this.s.list(req.user.sub,page,pageSize,organizationId,search)}
  @Get('follow-up/overdue') @RequirePermission('commitment.read') overdue(@Req() req:any,@Query('page') page?:string,@Query('pageSize') pageSize?:string,@Query('organizationId') organizationId?:string){return this.s.listOverdue(req.user.sub,page,pageSize,organizationId)}
  @Get('follow-up/due-soon') @RequirePermission('commitment.read') dueSoon(@Req() req:any,@Query('days') days?:string,@Query('page') page?:string,@Query('pageSize') pageSize?:string,@Query('organizationId') organizationId?:string){return this.s.listDueSoon(req.user.sub, days?Number(days):undefined,page,pageSize,organizationId)}
  @Post('follow-up/sweep-overdue') @RequirePermission('commitment.write') sweep(@Req() req:any){return this.s.sweepOverdue(req.user.sub)}
  @Get(':id') @RequirePermission('commitment.read') get(@Param('id') id:string,@Req() req:any){return this.s.get(req.user.sub,id)}
  @Post() @RequirePermission('commitment.write') create(@Body() d:CommitmentDto,@Req() req:any){return this.s.create(req.user.sub,d)}
  @Post(':id/mark-overdue') @RequirePermission('commitment.write') markOverdue(@Param('id') id:string,@Req() req:any){return this.s.markOverdue(req.user.sub,id)}
  @Patch(':id') @RequirePermission('commitment.write') update(@Param('id') id:string,@Body() d:UpdateCommitmentDto,@Req() req:any){return this.s.update(req.user.sub,id,d)}
  @Delete(':id') @RequirePermission('commitment.write') remove(@Param('id') id:string,@Req() req:any){return this.s.remove(req.user.sub,id)}
}
