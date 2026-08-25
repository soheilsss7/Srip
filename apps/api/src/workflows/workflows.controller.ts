import {Body,Controller,Get,Param,Post,UseGuards,Req} from '@nestjs/common';
import {AuthGuard} from '../common/guards/auth.guard'; import {AuthorizationGuard} from '../common/guards/authorization.guard'; import {RequirePermission} from '../common/decorators/require-permission.decorator'; import {WorkflowsService} from './workflows.service';
@Controller('workflows') @UseGuards(AuthGuard, AuthorizationGuard)
export class WorkflowsController { constructor(private readonly w:WorkflowsService){}
 @Get() @RequirePermission('workflow.read') list(@Req() req:any){return this.w.list(req.user.sub)}
 @Post() @RequirePermission('workflow.write') create(@Body() body:any,@Req() req:any){return this.w.create(req.user.sub,body)}
 @Post(':id/execute') @RequirePermission('workflow.execute') execute(@Param('id')id:string,@Body()b:any,@Req() req:any){return this.w.execute(req.user.sub,id,b.entityType,b.entityId,b.context,b.triggerType??'MANUAL')}
 @Post('trigger') @RequirePermission('workflow.execute') trigger(@Body()b:any,@Req() req:any){return this.w.trigger(req.user.sub,b.triggerType,b.entityType,b.entityId,b.context)}
 @Post('executions/:executionId/resume') @RequirePermission('workflow.execute') resume(@Param('executionId')id:string,@Req() req:any){return this.w.resume(req.user.sub,id)}
 @Post('executions/:executionId/approval') @RequirePermission('workflow.execute') approveRequest(@Param('executionId')id:string,@Body()b:any,@Req() req:any){return this.w.requestApproval(req.user.sub,id,b.payload)}
 @Post('approvals/:approvalId/decision') @RequirePermission('workflow.execute') decide(@Param('approvalId')id:string,@Body()b:any,@Req() req:any){return this.w.decideApproval(req.user.sub,id,b.decision,b.reason)}
}
