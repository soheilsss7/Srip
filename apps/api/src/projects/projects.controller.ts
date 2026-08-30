import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Priority, ProjectStatus, RequirementStatus, MilestoneStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
class ProjectDto { @IsString() @MinLength(2) name!:string; @IsString() @IsOptional() description?:string; @IsEnum(ProjectStatus) @IsOptional() status?:ProjectStatus; @IsEnum(Priority) @IsOptional() priority?:Priority; @IsString() @IsOptional() objective?:string; @IsDateString() @IsOptional() startAt?:string; @IsDateString() @IsOptional() targetAt?:string; @IsString() @IsOptional() organizationId?:string; @IsString() @IsOptional() ownerId?:string; }
class RequirementDto { @IsString() projectId!:string; @IsString() @MinLength(2) title!:string; @IsString() @IsOptional() description?:string; @IsString() @IsOptional() category?:string; @IsEnum(RequirementStatus) @IsOptional() status?:RequirementStatus; @IsEnum(Priority) @IsOptional() priority?:Priority; @IsString() @IsOptional() organizationId?:string; }
class LinkRelationshipDto { @IsString() relationshipId!:string; @IsOptional() required?:boolean; @IsOptional() relevance?:number; @IsOptional() status?:string; }
class RiskDto { @IsString() @MinLength(2) title!:string; @IsString() @IsOptional() description?:string; @IsInt() @Min(0) @Max(100) @IsOptional() probability?:number; @IsInt() @Min(0) @Max(100) @IsOptional() impact?:number; @IsString() @IsOptional() mitigation?:string; @IsString() @IsOptional() ownerId?:string; @IsString() @IsOptional() status?:string; }
class MilestoneDto { @IsString() @MinLength(2) title!:string; @IsString() @IsOptional() description?:string; @IsEnum(MilestoneStatus) @IsOptional() status?:MilestoneStatus; @IsDateString() @IsOptional() dueAt?:string; @IsDateString() @IsOptional() completedAt?:string; @IsString() @IsOptional() ownerId?:string; }
@Controller('projects') @UseGuards(AuthGuard, AuthorizationGuard) export class ProjectsController {
 constructor(private readonly s:ProjectsService){}
 @Get() @RequirePermission('project.read') list(@Req() req:any,@Query('page') page?:string,@Query('pageSize') pageSize?:string,@Query('organizationId') organizationId?:string,@Query('search') search?:string){return this.s.list(req.user.sub,page,pageSize,organizationId,search)}
 @Get(':id') @RequirePermission('project.read') get(@Param('id') id:string,@Req() req:any){return this.s.get(req.user.sub,id)}
 @Post() @RequirePermission('project.write') create(@Body() d:ProjectDto,@Req() req:any){return this.s.create(req.user.sub,d)}
 @Patch(':id') @RequirePermission('project.write') update(@Param('id') id:string,@Body() d:Partial<ProjectDto>,@Req() req:any){return this.s.update(req.user.sub,id,d)}
 @Delete(':id') @RequirePermission('project.write') remove(@Param('id') id:string,@Req() req:any){return this.s.remove(req.user.sub,id)}
 @Post('requirements') @RequirePermission('project.write') requirement(@Body() d:RequirementDto,@Req() req:any){return this.s.addRequirement(req.user.sub,d)}
 @Patch('requirements/:id') @RequirePermission('project.write') updateRequirement(@Param('id') id:string,@Body() d:Partial<RequirementDto>,@Req() req:any){return this.s.updateRequirement(req.user.sub,id,d)}
 @Delete('requirements/:id') @RequirePermission('project.write') removeRequirement(@Param('id') id:string,@Req() req:any){return this.s.removeRequirement(req.user.sub,id)}
 @Post(':id/relationships') @RequirePermission('project.write') linkRelationship(@Param('id') id:string,@Body() d:LinkRelationshipDto,@Req() req:any){return this.s.linkRelationship(req.user.sub,id,d)}
 @Delete(':id/relationships/:relationshipId') @RequirePermission('project.write') unlinkRelationship(@Param('id') id:string,@Param('relationshipId') relationshipId:string,@Req() req:any){return this.s.unlinkRelationship(req.user.sub,id,relationshipId)}
 @Post(':id/risks') @RequirePermission('project.write') addRisk(@Param('id') id:string,@Body() d:RiskDto,@Req() req:any){return this.s.addRisk(req.user.sub,id,d)}
 @Patch('risks/:riskId') @RequirePermission('project.write') updateRisk(@Param('riskId') id:string,@Body() d:Partial<RiskDto>,@Req() req:any){return this.s.updateRisk(req.user.sub,id,d)}
 @Delete('risks/:riskId') @RequirePermission('project.write') removeRisk(@Param('riskId') id:string,@Req() req:any){return this.s.removeRisk(req.user.sub,id)}
 @Post(':id/milestones') @RequirePermission('project.write') addMilestone(@Param('id') id:string,@Body() d:MilestoneDto,@Req() req:any){return this.s.addMilestone(req.user.sub,id,d)}
 @Patch('milestones/:milestoneId') @RequirePermission('project.write') updateMilestone(@Param('milestoneId') id:string,@Body() d:Partial<MilestoneDto>,@Req() req:any){return this.s.updateMilestone(req.user.sub,id,d)}
 @Delete('milestones/:milestoneId') @RequirePermission('project.write') removeMilestone(@Param('milestoneId') id:string,@Req() req:any){return this.s.removeMilestone(req.user.sub,id)}
}
