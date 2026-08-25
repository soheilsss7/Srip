import { Body, Controller, Get, Post, Req, UseGuards, Query } from '@nestjs/common';
import { AiService } from './ai.service'; import { AiGatewayService, AiIntent } from './ai.gateway.service'; import { AiPipelineService } from './ai-pipeline.service'; import { AuthGuard } from '../common/guards/auth.guard'; import { AuthorizationGuard } from '../common/guards/authorization.guard'; import { RequirePermission } from '../common/decorators/require-permission.decorator';
@Controller('ai') @UseGuards(AuthGuard, AuthorizationGuard)
export class AiController {
 constructor(private readonly service:AiService,private readonly gateway:AiGatewayService,private readonly pipeline:AiPipelineService){}
 @Get('status') status(){return this.service.status();}
 @Get('provider-health') providerHealth(){return this.service.providerHealth();}
 @Get('usage') usage(){return this.service.usage();}
 @Get('executive-brief') @RequirePermission('ai.executive_brief') executiveBrief(@Req() req:any,@Query('organizationId') organizationId?:string,@Query('weekStart') weekStart?:string){return this.gateway.executiveBrief(req.user.sub,organizationId,weekStart);}
 @Post('query') query(@Req() req:any,@Body() body:{intent:AiIntent;query:string;organizationId?:string;meetingId?:string;relationshipId?:string}){return this.gateway.execute({...body,userId:req.user.sub});}
 @Post('retrieve') retrieve(@Req() req:any,@Body() body:{query:string;organizationId?:string}){return this.pipeline.retrieve(req.user.sub,body.query,body.organizationId);}
}
