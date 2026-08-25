import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { PeopleService } from './people.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class CreatePersonDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsString() @MinLength(1) lastName!: string;
  @IsString() organizationId!: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() status?: string;
  @IsInt() @Min(0) @Max(100) @IsOptional() influenceScore?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() decisionPower?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() accessibilityScore?: number;
}

class UpdatePersonDto {
  @IsString() @MinLength(1) @IsOptional() firstName?: string;
  @IsString() @MinLength(1) @IsOptional() lastName?: string;
  @IsString() @IsOptional() organizationId?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() status?: string;
  @IsInt() @Min(0) @Max(100) @IsOptional() influenceScore?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() decisionPower?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() accessibilityScore?: number;
}

class OrganizationPersonDto {
  @IsString() organizationId!: string;
  @IsString() @IsOptional() roleTitle?: string;
  @IsString() @IsOptional() department?: string;
  @IsOptional() isPrimary?: boolean;
}

@Controller('people')
@UseGuards(AuthGuard, AuthorizationGuard)
export class PeopleController {
  constructor(private readonly s: PeopleService) {}
  @Get() @RequirePermission('person.read') list(@Req() req: any, @Query('q') q?: string, @Query('organizationId') organizationId?: string, @Query('page') page?: string, @Query('pageSize') pageSize?: string) { return this.s.list(req.user.sub, q, organizationId, Number(page || 1), Number(pageSize || 50)); }
  @Get(':id/timeline') @RequirePermission('person.read') timeline(@Param('id') id: string, @Req() req: any) { return this.s.timeline(req.user.sub, id); }
  @Delete(':id/organizations/:organizationId') @RequirePermission('person.write') removeOrganization(@Param('id') id: string, @Param('organizationId') organizationId: string, @Req() req: any) { return this.s.removeOrganization(req.user.sub, id, organizationId); }
  @Get(':id/organizations') @RequirePermission('person.read') organizations(@Param('id') id: string, @Req() req: any) { return this.s.listOrganizations(req.user.sub, id); }
  @Get(':id') @RequirePermission('person.read') get(@Param('id') id: string, @Req() req: any) { return this.s.get(req.user.sub, id); }
  @Post() @RequirePermission('person.write') create(@Body() d: CreatePersonDto, @Req() req: any) { return this.s.create(req.user.sub, d); }
  @Post(':id/organizations') @RequirePermission('person.write') addOrganization(@Param('id') id: string, @Body() d: OrganizationPersonDto, @Req() req: any) { return this.s.addOrganization(req.user.sub, id, d.organizationId, d.roleTitle, d.department, d.isPrimary === true); }
  @Patch(':id') @RequirePermission('person.write') update(@Param('id') id: string, @Body() d: UpdatePersonDto, @Req() req: any) { return this.s.update(req.user.sub, id, d as any); }
  @Patch(':id/archive') @RequirePermission('person.write') archive(@Param('id') id: string, @Req() req: any) { return this.s.archive(req.user.sub, id); }
  @Post(':id/restore') @RequirePermission('data.restore') restore(@Param('id') id: string, @Req() req: any) { return this.s.restore(req.user.sub, id); }
}
