import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventBusService, DomainEvent } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { TraceService } from '../observability/trace.service';
import { WorkflowApprovalService } from './workflow-approval.service';

type WorkflowAction = { type:string; [key:string]:any };
type WorkflowDefinition = { trigger?: { type:string; entityType?:string }; conditions?: Array<{ path:string; equals?:any; notEquals?:any; exists?:boolean }>; actions?: WorkflowAction[] };

type WorkflowEntityLinks = {
  relationshipId?: string;
  meetingId?: string;
  projectId?: string;
  personId?: string;
  organizationId?: string;
  recommendationId?: string;
};

function resolveWorkflowEntityLinks(
  entityType: string,
  entityId: string,
  context: any,
  action: WorkflowAction,
  fallbackOrganizationId?: string | null,
): WorkflowEntityLinks {
  const event = context?.event ?? {};
  const normalized = String(entityType ?? '').toLowerCase();
  const links: WorkflowEntityLinks = {
    relationshipId: action.relationshipId ?? context?.relationshipId,
    meetingId: action.meetingId ?? context?.meetingId,
    projectId: action.projectId ?? context?.projectId,
    personId: action.personId ?? context?.personId,
    organizationId:
      action.organizationId ??
      context?.organizationId ??
      event.organizationId ??
      fallbackOrganizationId ??
      undefined,
    recommendationId: action.recommendationId ?? context?.recommendationId,
  };

  if (normalized === 'relationship' && !links.relationshipId) links.relationshipId = entityId;
  if (normalized === 'meeting' && !links.meetingId) links.meetingId = entityId;
  if (normalized === 'project' && !links.projectId) links.projectId = entityId;
  if (normalized === 'person' && !links.personId) links.personId = entityId;
  if (normalized === 'organization' && !links.organizationId) links.organizationId = entityId;
  if (normalized === 'recommendation' && !links.recommendationId) links.recommendationId = entityId;

  return links;
}


@Injectable()
export class WorkflowsService {
  private readonly logger = new Logger(WorkflowsService.name);
  constructor(private readonly prisma:PrismaService, private readonly authorization:AuthorizationService, private readonly notifications:NotificationsService, private readonly eventBus:EventBusService, private readonly audit:AuditService, private readonly requestContext: RequestContext, private readonly trace: TraceService, private readonly workflowApprovals: WorkflowApprovalService){}

  async list(userId:string){
    const ids=await this.authorization.accessibleOrganizationIds(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.workflow.findMany({where:{deletedAt:null,...(ids?{OR:[{organizationId:{in:ids}},{organizationId:null}]}:{})},orderBy:{createdAt:'desc'}}))
  }

  async create(userId:string,data:any){
    if(!data?.name || !data?.entityType || !data?.definition) throw new BadRequestException('name, entityType and definition are required');
    if(data.organizationId) await this.authorization.assertPermission(userId, 'workflow.write', { organizationId: data.organizationId });
    this.validateDefinition(data.definition);
    const row=await this.prisma.workflow.create({data:{name:data.name,entityType:data.entityType,organizationId:data.organizationId??null,isActive:data.isActive??true,definition:data.definition}}); await this.audit.logMutation({userId,action:'CREATE',entityType:'Workflow',entityId:row.id,organizationId:row.organizationId??undefined,after:row,reason:'workflow-created'}); return EntityResponseDto.fromUnknown(row)
  }

  async execute(userId:string,id:string,entityType:string,entityId:string,context:any={}, triggerType='MANUAL', systemExecution=false){
    const wf=await this.prisma.workflow.findUnique({where:{id}});
    if(!wf||wf.deletedAt||!wf.isActive) throw new NotFoundException('Active workflow not found');
    if(wf.organizationId && !systemExecution) await this.authorization.assertPermission(userId, 'workflow.execute', { organizationId: wf.organizationId });
    const definition=wf.definition as unknown as WorkflowDefinition;
    if(definition.trigger && definition.trigger.type!=='MANUAL' && definition.trigger.type!==triggerType) throw new BadRequestException('Workflow trigger does not match');
    if(definition.trigger?.entityType && definition.trigger.entityType!==entityType) throw new BadRequestException('Workflow entity type does not match');
    if(!this.conditionsPass(definition.conditions??[],context)) throw new BadRequestException('Workflow conditions are not satisfied');
    const execution=await this.prisma.workflowExecution.create({data:{workflowId:id,entityType,entityId,status:'RUNNING',currentActionIndex:0,requestId:this.requestContext.requestId,correlationId:this.requestContext.correlationId,context:{...context,triggerType,requestId:this.requestContext.requestId,correlationId:this.requestContext.correlationId}}});
    return this.runExecutionFromIndex(userId, execution.id, 0, systemExecution);
  }

  private async runExecutionFromIndex(userId:string, executionId:string, startIndex:number, systemExecution=false){
    const execution=await this.prisma.workflowExecution.findUnique({where:{id:executionId},include:{workflow:true}});
    if(!execution) throw new NotFoundException('Execution not found');
    const executionSpan = this.trace.childSpan('workflow.execution', { workflowExecutionId: execution.id, workflowId: execution.workflowId, entityType: execution.entityType, entityId: execution.entityId, requestId: execution.requestId ?? null, correlationId: execution.correlationId ?? null });
    if(['COMPLETED','FAILED','REJECTED'].includes(execution.status)) { executionSpan.end('OK'); return EntityResponseDto.fromUnknown(execution); }
    const definition=execution.workflow.definition as unknown as WorkflowDefinition;
    const context:any = execution.context ?? {};
    try {
      for(let index=Math.max(0,startIndex); index<(definition.actions??[]).length; index++) {
        await this.prisma.workflowExecution.update({where:{id:executionId},data:{currentActionIndex:index}});
        await this.runAction(userId,definition.actions![index],execution.entityType,execution.entityId,context,executionId,execution.workflow.organizationId,systemExecution,index+1);
        const state=await this.prisma.workflowExecution.findUnique({where:{id:executionId},select:{status:true,currentActionIndex:true,context:true}});
        if(state?.status==='WAITING') { executionSpan.end('OK',{workflowStatus:'WAITING'}); return EntityResponseDto.fromUnknown(await this.prisma.workflowExecution.findUnique({where:{id:executionId}})); }
      }
      const completed = await this.prisma.workflowExecution.update({where:{id:executionId},data:{status:'COMPLETED',finishedAt:new Date(),currentActionIndex:(definition.actions??[]).length}}); executionSpan.end('OK'); return EntityResponseDto.fromUnknown(completed);
    } catch(error:any) {
      executionSpan.end('ERROR',{errorMessage:error?.message??'workflow action failed'});
      await this.prisma.workflowExecution.update({where:{id:executionId},data:{status:'FAILED',finishedAt:new Date(),context:{...context,error:error?.message??'workflow action failed'}}});
      throw error;
    }
  }

  async trigger(userId:string,triggerType:string,entityType:string,entityId:string,context:any={}){
    const ids=await this.authorization.accessibleOrganizationIds(userId);
    const workflows=await this.prisma.workflow.findMany({where:{isActive:true,deletedAt:null,entityType,...(ids?{OR:[{organizationId:{in:ids}},{organizationId:null}]}:{})}});
    const results=[]; for(const wf of workflows){ const d=wf.definition as any; if(d?.trigger?.type!==triggerType) continue; results.push(await this.execute(userId,wf.id,entityType,entityId,context,triggerType)); }
    return EntityResponseDto.fromUnknown(results as any);
  }

  async triggerFromDomainEvent(event: DomainEvent) {
    const supported = new Set<string>(Object.values(DOMAIN_EVENT_TYPES));
    if (!supported.has(event.eventType)) return [];
    const workflows = await this.prisma.workflow.findMany({
      where: { isActive: true, deletedAt: null, entityType: event.aggregateType, ...(event.organizationId ? { OR: [{ organizationId: event.organizationId }, { organizationId: null }] } : { organizationId: null }) },
    });
    const results: any[] = [];
    for (const wf of workflows) {
      const definition = wf.definition as unknown as WorkflowDefinition;
      const trigger = definition.trigger;
      const triggerType = trigger?.type;
      if (triggerType !== event.eventType && triggerType !== event.aggregateType && triggerType !== '*') continue;
      if (trigger?.entityType && trigger.entityType !== event.aggregateType) continue;
      let delivery: any;
      try {
        delivery = await this.prisma.workflowEventDelivery.create({ data: { workflowId: wf.id, eventId: event.id, eventType: event.eventType, status: 'PROCESSING' } });
      } catch (error: any) {
        if (error?.code === 'P2002') continue;
        throw error;
      }
      const actorId = event.actorId ?? await this.findAutomationActor(event.organizationId);
      if (!actorId) {
        await this.prisma.workflowEventDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: 'No active automation actor available', completedAt: new Date() } });
        continue;
      }
      const context = {
        event: { id: event.id, type: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, organizationId: event.organizationId, actorId: event.actorId, version: event.version, occurredAt: event.occurredAt },
        payload: event.payload,
      };
      try {
        const result = await this.execute(actorId, wf.id, event.aggregateType, event.aggregateId, context, event.eventType, true);
        await this.prisma.workflowEventDelivery.update({ where: { id: delivery.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        results.push(result);
      } catch (error: any) {
        await this.prisma.workflowEventDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: String(error?.message ?? error), completedAt: new Date() } });
        this.logger.warn(`Workflow ${wf.id} failed for event ${event.id}: ${error?.message ?? error}`);
      }
    }
    return EntityResponseDto.fromUnknown(results as any);
  }

  private async findAutomationActor(organizationId?: string) {
    if (organizationId) {
      const membership = await this.prisma.membership.findFirst({ where: { organizationId, user: { isActive: true, deletedAt: null } }, select: { userId: true }, orderBy: { createdAt: 'asc' } });
      if (membership) return membership.userId;
    }
    const user = await this.prisma.user.findFirst({ where: { isActive: true, deletedAt: null }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    return user?.id;
  }

  async resume(userId:string,executionId:string){
    const execution=await this.prisma.workflowExecution.findUnique({where:{id:executionId},include:{workflow:true}}); if(!execution) throw new NotFoundException('Execution not found');
    if(execution.workflow.organizationId) await this.authorization.assertPermission(userId, 'workflow.execute', { organizationId: execution.workflow.organizationId });
    if(execution.status!=='WAITING') throw new BadRequestException('Execution is not waiting');
    if(execution.resumeAt && execution.resumeAt>new Date()) throw new BadRequestException('Workflow wait period has not elapsed');
    return this.runExecutionFromIndex(userId, executionId, execution.currentActionIndex ?? 0, false);
  }

  async requestApproval(userId:string,executionId:string,payload:any,nextActionIndex?:number){
    const result = await this.workflowApprovals.request(userId, executionId, payload, nextActionIndex);
    return EntityResponseDto.fromUnknown(result);
  }

  async decideApproval(userId:string,approvalId:string,decision:'APPROVED'|'REJECTED',reason?:string){
    const result = await this.workflowApprovals.decide(userId, approvalId, decision, reason);
    if (result.decision === 'REJECTED') return EntityResponseDto.fromUnknown(result.approval);
    const resumed = await this.runExecutionFromIndex(userId, result.workflowExecutionId, result.resumeFromIndex, false);
    return EntityResponseDto.fromUnknown({ approval: result.approval, execution: resumed });
  }

  private validateDefinition(definition:any){
    if(typeof definition!=='object' || !Array.isArray(definition.actions)) throw new BadRequestException('Invalid workflow definition');
    const allowed=['CREATE_NOTIFICATION','CREATE_ACTION','CREATE_COMMITMENT','CREATE_OPPORTUNITY','REQUEST_APPROVAL','WAIT'];
    for(const action of definition.actions){ if(!allowed.includes(action.type)) throw new BadRequestException(`Unsupported workflow action: ${action.type}`); }
  }

  private getPath(obj:any,path:string){ return path.split('.').reduce((v,k)=>v==null?undefined:v[k],obj); }
  private conditionsPass(conditions:any[],context:any){ return conditions.every(c=>{const value=this.getPath(context,c.path); if(c.exists!==undefined) return c.exists=== (value!==undefined && value!==null); if('equals' in c) return value===c.equals; if('notEquals' in c) return value!==c.notEquals; return true;}); }

  private async assertWorkflowEntityContext(userId:string, links:WorkflowEntityLinks, systemExecution:boolean) {
    if (systemExecution) return;
    if (links.relationshipId) await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: links.organizationId, entityType: 'Relationship', entityId: links.relationshipId });
    if (links.meetingId) await this.authorization.assertPermission(userId, 'meeting.read', { organizationId: links.organizationId, entityType: 'Meeting', entityId: links.meetingId });
    if (links.projectId) await this.authorization.assertPermission(userId, 'project.read', { organizationId: links.organizationId, entityType: 'Project', entityId: links.projectId });
    if (links.personId) await this.authorization.assertPermission(userId, 'person.read', { organizationId: links.organizationId, entityType: 'Person', entityId: links.personId });
  }

  private async runAction(userId:string,action:WorkflowAction,entityType:string,entityId:string,context:any,executionId:string,organizationId:string|null,systemExecution=false,nextActionIndex=0){
    if(action.type==='REQUEST_APPROVAL') { await this.requestApproval(userId,executionId,action.payload??context,nextActionIndex); return; }
    if(action.type==='CREATE_NOTIFICATION') {
      const targetUserId=action.userId??userId;
      return this.notifications.create(targetUserId,{type:action.notificationType??'INFO',title:action.title??'Workflow notification',body:action.body??`Workflow ${entityType} ${entityId}`,channel:action.channel??'IN_APP',priority:action.priority??'MEDIUM',deepLink:action.deepLink,data:{workflowExecutionId:executionId,entityType,entityId,context}});
    }
    if(action.type==='WAIT') {
      const minutes=Math.max(1,Number(action.minutes??0)); if(!Number.isFinite(minutes)) throw new BadRequestException('WAIT.minutes must be a number');
      return EntityResponseDto.fromUnknown(await this.prisma.workflowExecution.update({where:{id:executionId},data:{status:'WAITING',resumeAt:new Date(Date.now()+minutes*60000),currentActionIndex:nextActionIndex}}));
    }
    if(action.type==='CREATE_ACTION') {
      const links = resolveWorkflowEntityLinks(entityType, entityId, context, action, organizationId);
      const effectiveOrganizationId = links.organizationId ?? undefined;
      await this.assertWorkflowEntityContext(userId, links, systemExecution);
      if(effectiveOrganizationId && !systemExecution) await this.authorization.assertPermission(userId, 'action.write', { organizationId: effectiveOrganizationId });
      const createdAction=await this.eventBus.transaction(async tx=>{
        const row=await tx.action.create({data:{
          title:action.title??'Workflow action',
          status:action.status??'OPEN',
          priority:action.priority??'MEDIUM',
          dueAt:action.dueAt?new Date(action.dueAt):null,
          ownerId:userId,
          relationshipId:links.relationshipId,
          meetingId:links.meetingId,
          projectId:links.projectId,
          personId:links.personId,
          organizationId:effectiveOrganizationId,
          recommendationId:links.recommendationId,
        }});
        await this.audit.logMutation({userId,action:'CREATE',entityType:'Action',entityId:row.id,organizationId:effectiveOrganizationId,after:row,reason:'workflow_create_action'},tx);
        await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ACTION_CREATED,aggregateType:'Action',aggregateId:row.id,organizationId:effectiveOrganizationId,actorId:userId,payload:row as any});
        return row;
      });
      return EntityResponseDto.fromUnknown(createdAction);
    }
    if(action.type==='CREATE_COMMITMENT') {
      const links = resolveWorkflowEntityLinks(entityType, entityId, context, action, organizationId);
      const effectiveOrganizationId = links.organizationId ?? undefined;
      await this.assertWorkflowEntityContext(userId, links, systemExecution);
      if(effectiveOrganizationId && !systemExecution) await this.authorization.assertPermission(userId, 'commitment.write', { organizationId: effectiveOrganizationId });
      const createdCommitment=await this.eventBus.transaction(async tx=>{
        const row=await tx.commitment.create({data:{
          description:action.description??action.title??'Workflow commitment',
          status:action.status??'OPEN',
          dueAt:action.dueAt?new Date(action.dueAt):null,
          ownerId:userId,
          relationshipId:links.relationshipId,
          meetingId:links.meetingId,
          projectId:links.projectId,
          personId:links.personId,
          organizationId:effectiveOrganizationId,
          recommendationId:links.recommendationId,
        }});
        await this.audit.logMutation({userId,action:'CREATE',entityType:'Commitment',entityId:row.id,organizationId:effectiveOrganizationId,after:row,reason:'workflow_create_commitment'},tx);
        await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.COMMITMENT_CREATED,aggregateType:'Commitment',aggregateId:row.id,organizationId:effectiveOrganizationId,actorId:userId,payload:row as any});
        return row;
      });
      return EntityResponseDto.fromUnknown(createdCommitment);
    }
    if(action.type==='CREATE_OPPORTUNITY') {
      const links = resolveWorkflowEntityLinks(entityType, entityId, context, action, organizationId);
      const effectiveOrganizationId = links.organizationId ?? undefined;
      await this.assertWorkflowEntityContext(userId, links, systemExecution);
      if(effectiveOrganizationId) await this.authorization.assertPermission(userId, 'opportunity.write', { organizationId: effectiveOrganizationId });
      const createdOpportunity=await this.eventBus.transaction(async tx=>{
        const row=await tx.opportunity.create({data:{
          name:action.name??'Workflow opportunity',
          status:action.status??'IDENTIFIED',
          organizationId:effectiveOrganizationId,
          projectId:links.projectId,
          relationshipId:links.relationshipId,
        }});
        await this.audit.logMutation({userId,action:'CREATE',entityType:'Opportunity',entityId:row.id,organizationId:effectiveOrganizationId,after:row,reason:'workflow_create_opportunity'},tx);
        await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.OPPORTUNITY_CREATED,aggregateType:'Opportunity',aggregateId:row.id,organizationId:effectiveOrganizationId,actorId:userId,payload:row as any});
        return row;
      });
      return EntityResponseDto.fromUnknown(createdOpportunity);
    }
    throw new ForbiddenException('Unsupported workflow action');
  }
}
