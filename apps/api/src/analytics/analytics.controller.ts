import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsObject, IsOptional, IsString } from 'class-validator';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

class OutcomeDto { @IsString() outcome!: string; @IsOptional() @IsObject() outcomeValue?: Record<string, unknown>; }

@Controller('analytics') @UseGuards(AuthGuard, AuthorizationGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Get('status') @RequirePermission('analytics.read') status(){ return this.service.status(); }
  @Get('summary') @RequirePermission('analytics.read') summary(@Req() req:any){ return this.service.summary(req.user.sub); }
  @Get('network') @RequirePermission('analytics.read') network(@Req() req:any,@Query('organizationId') organizationId?:string){ return this.service.strategicNetworkMetrics(req.user.sub, organizationId); }
  @Get('workflows') @RequirePermission('analytics.read') workflow(@Req() req:any){ return this.service.workflow(req.user.sub); }
  @Get('recommendations/funnel') @RequirePermission('analytics.read') funnel(@Req() req:any,@Query('from') from?:string,@Query('to') to?:string){ return this.service.recommendationFunnel(req.user.sub,from?new Date(from):undefined,to?new Date(to):undefined); }
  @Post('recommendations/:id/outcome') @RequirePermission('analytics.write') outcome(@Param('id') id:string,@Body() body:OutcomeDto,@Req() req:any){ return this.service.recordRecommendationOutcome(req.user.sub,id,body.outcome,body.outcomeValue); }
  @Post('events') @RequirePermission('analytics.write') record(@Req() req:any,@Body() body:any){ return this.service.record(req.user.sub,body); }
}
