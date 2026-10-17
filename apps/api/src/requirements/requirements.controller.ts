import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequirementMatchingService } from './requirement-matching.service';
@Controller('requirements') @UseGuards(AuthGuard,AuthorizationGuard)
export class RequirementsController { constructor(private readonly service:RequirementMatchingService){} @Get(':id/matches') @RequirePermission('project.read') matches(@Req()r:any,@Param('id')id:string,@Query('limit')limit?:string){return this.service.match(r.user.sub,id,Number(limit)||20)} }
