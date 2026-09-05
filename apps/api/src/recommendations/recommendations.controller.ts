import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RecommendationsService, RECOMMENDATION_TYPES } from './recommendations.service';

class GenerateDto { @IsString() @IsOptional() organizationId?:string; }
class EditDto { @IsString() @MinLength(3) @IsOptional() title?:string; @IsString() @MinLength(3) @IsOptional() rationale?:string; @IsInt() @Min(0) @Max(100) @IsOptional() confidence?:number; @IsObject() @IsOptional() evidence?:Record<string,unknown>; }
class SnoozeDto { @IsDateString() until!:string; }
class AssignDto { @IsString() assigneeId!:string; }

@Controller('recommendations') @UseGuards(AuthGuard,AuthorizationGuard)
export class RecommendationsController {
 constructor(private readonly service:RecommendationsService){}
 @Get('status') @RequirePermission('recommendation.read') status(){return this.service.status()}
 @Get() @RequirePermission('recommendation.read') list(@Req() req:any,@Query('status') status?:any,@Query('type') type?:any){return this.service.list(req.user.sub,status,type)}
 @Post(':id/view') @RequirePermission('recommendation.read') view(@Param('id') id:string,@Req() req:any){return this.service.view(req.user.sub,id)}
 @Post(':id/accept') @RequirePermission('recommendation.write') accept(@Param('id') id:string,@Req() req:any){return this.service.accept(req.user.sub,id)}
 @Get(':id') @RequirePermission('recommendation.read') get(@Param('id') id:string,@Req() req:any){return this.service.get(req.user.sub,id)}
 @Get(':id/explain') @RequirePermission('recommendation.read') explain(@Param('id') id:string,@Req() req:any){return this.service.explain(req.user.sub,id)}
 @Post('generate') @HttpCode(200) @RequirePermission('recommendation.write') generate(@Body() d:GenerateDto,@Req() req:any){return this.service.generate(req.user.sub,d.organizationId)}
 @Post(':id/approve') @HttpCode(200) @RequirePermission('recommendation.write') approve(@Param('id') id:string,@Req() req:any){return this.service.approve(req.user.sub,id)}
 @Post(':id/reject') @HttpCode(200) @RequirePermission('recommendation.write') reject(@Param('id') id:string,@Req() req:any){return this.service.reject(req.user.sub,id)}
 @Patch(':id') @RequirePermission('recommendation.write') edit(@Param('id') id:string,@Body() d:EditDto,@Req() req:any){return this.service.edit(req.user.sub,id,d)}
 @Post(':id/snooze') @HttpCode(200) @RequirePermission('recommendation.write') snooze(@Param('id') id:string,@Body() d:SnoozeDto,@Req() req:any){return this.service.snooze(req.user.sub,id,new Date(d.until))}
 @Post(':id/assign') @HttpCode(200) @RequirePermission('recommendation.write') assign(@Param('id') id:string,@Body() d:AssignDto,@Req() req:any){return this.service.assign(req.user.sub,id,d.assigneeId)}
 @Post(':id/execute') @HttpCode(200) @RequirePermission('recommendation.write') execute(@Param('id') id:string,@Req() req:any){return this.service.execute(req.user.sub,id)}
}
