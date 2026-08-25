import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min, MinLength } from 'class-validator';
import { OrganizationType } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';

class CreateOrganizationDto { @IsString() @MinLength(2) name!: string; @IsString() @IsOptional() legalName?: string; @IsString() @IsOptional() englishName?: string; @IsString() @IsOptional() displayName?: string; @IsEnum(OrganizationType) @IsOptional() type?: OrganizationType; @IsString() @IsOptional() industry?: string; @IsString() @IsOptional() country?: string; @IsString() @IsOptional() city?: string; @IsString() @IsOptional() address?: string; @IsUrl() @IsOptional() website?: string; @IsString() @IsOptional() phone?: string; @IsEmail() @IsOptional() email?: string; @IsString() @IsOptional() registrationId?: string; @IsString() @IsOptional() parentOrganizationId?: string; @IsString() @IsOptional() ownerId?: string; @IsInt() @Min(0) @Max(100) @IsOptional() strategicImportance?: number; }
class UpdateOrganizationDto { @IsString() @MinLength(2) @IsOptional() name?: string; @IsString() @IsOptional() legalName?: string; @IsString() @IsOptional() englishName?: string; @IsString() @IsOptional() displayName?: string; @IsEnum(OrganizationType) @IsOptional() type?: OrganizationType; @IsString() @IsOptional() industry?: string; @IsString() @IsOptional() country?: string; @IsString() @IsOptional() city?: string; @IsString() @IsOptional() address?: string; @IsUrl() @IsOptional() website?: string; @IsString() @IsOptional() phone?: string; @IsEmail() @IsOptional() email?: string; @IsString() @IsOptional() registrationId?: string; @IsString() @IsOptional() parentOrganizationId?: string; @IsString() @IsOptional() ownerId?: string; @IsInt() @Min(0) @Max(100) @IsOptional() strategicImportance?: number; @IsEnum(OrganizationType) @IsOptional() status?: never; }

@Controller('organizations')
@UseGuards(AuthGuard, AuthorizationGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Get() @RequirePermission('org.read') list(@Req() req: any, @Query('parentOrganizationId') parentOrganizationId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.service.list(req.user.sub, parentOrganizationId, Number(page || 1), Number(pageSize || 50)); }
  @Get(':id/timeline') @RequirePermission('org.read') timeline(@Param('id') id: string, @Req() req: any) { return this.service.timeline(req.user.sub, id); }
  @Get(':id') @RequirePermission('org.read') get(@Param('id') id: string, @Req() req: any) { return this.service.get(req.user.sub, id); }
  @Post() @RequirePermission('org.write') create(@Body() dto: CreateOrganizationDto, @Req() req: any) { return this.service.create(req.user.sub, dto); }
  @Patch(':id') @RequirePermission('org.write') update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @Req() req: any) { return this.service.update(req.user.sub, id, dto as any); }
  @Patch(':id/archive') @RequirePermission('org.write') archive(@Param('id') id: string, @Req() req: any) { return this.service.archive(req.user.sub, id); }
  @Post(':id/restore') @RequirePermission('data.restore') restore(@Param('id') id: string, @Req() req: any) { return this.service.restore(req.user.sub, id); }
}
