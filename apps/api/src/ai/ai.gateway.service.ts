import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AiPipelineService } from './ai-pipeline.service';
import { MetricsService } from '../observability/metrics.service';

export type AiIntent = 'SMART_SEARCH'|'MEETING_BRIEF'|'MEETING_SUMMARY'|'ACTION_EXTRACTION'|'COMMITMENT_EXTRACTION'|'RISK_DETECTION'|'OPPORTUNITY_DETECTION'|'NEXT_BEST_ACTION'|'EXECUTIVE_BRIEF';
export type AiRequest = { userId: string; intent: AiIntent; query: string; organizationId?: string; meetingId?: string; relationshipId?: string; };

@Injectable()
export class AiGatewayService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly pipeline: AiPipelineService, private readonly metrics:MetricsService, private readonly audit: AuditService) {}

  private async retrieve(request: AiRequest) {
    const orgIds = await this.authorization.accessibleOrganizationIds(request.userId);
    if (request.organizationId) await this.authorization.assertAnyOrganizationAccess(request.userId, [request.organizationId]);
    if (request.relationshipId) {
      const r = await this.prisma.relationship.findUnique({ where: { id: request.relationshipId }, select: { sourceOrganizationId:true, targetOrganizationId:true } });
      if (!r) throw new ForbiddenException('Relationship not found');
      await this.authorization.assertAnyOrganizationAccess(request.userId, [r.sourceOrganizationId, r.targetOrganizationId]);
    }
    if (request.meetingId) {
      const m = await this.prisma.meeting.findUnique({ where:{id:request.meetingId}, include:{organization:true, relationship:true, participants:{include:{person:true}}, actions:true, commitments:true} });
      if (!m || m.deletedAt) throw new ForbiddenException('Meeting not found');
      const ids = [m.organizationId, m.relationship?.sourceOrganizationId, m.relationship?.targetOrganizationId].filter(Boolean) as string[];
      if (orgIds && !ids.some(id => orgIds.includes(id))) throw new ForbiddenException('AI retrieval scope violation');
      return { meetings:[m], interactions:[], organizations:[] };
    }
    const q = request.query.trim();
    const scope = orgIds ? { in: orgIds } : undefined;
    const [organizations, meetings, interactions] = await Promise.all([
      this.prisma.organization.findMany({ where:{deletedAt:null, ...(scope?{id:scope}:{}), ...(q?{name:{contains:q,mode:'insensitive'}}:{})}, select:{id:true,name:true,type:true}, take:20 }),
      this.prisma.meeting.findMany({ where:{deletedAt:null, ...(scope?{organizationId:scope}:{}), ...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{objective:{contains:q,mode:'insensitive'}}]}:{})}, select:{id:true,title:true,objective:true,outcome:true,startAt:true,organizationId:true}, orderBy:{startAt:'desc'}, take:20 }),
      this.prisma.interaction.findMany({ where:{deletedAt:null, ...(scope?{organizationId:scope}:{}), ...(q?{OR:[{subject:{contains:q,mode:'insensitive'}},{summary:{contains:q,mode:'insensitive'}},{outcome:{contains:q,mode:'insensitive'}}]}:{})}, select:{id:true,subject:true,summary:true,outcome:true,occurredAt:true,organizationId:true}, orderBy:{occurredAt:'desc'}, take:20 })
    ]);
    return { organizations, meetings, interactions };
  }

  private draft(request: AiRequest, evidence: any) {
    if (request.intent === 'MEETING_BRIEF' && evidence.meetings?.[0]) {
      const m=evidence.meetings[0];
      return { type:'meeting_brief', text:`Prepare for ${m.title}. Objective: ${m.objective ?? 'not provided'}. Participants: ${(m.participants??[]).map((p:any)=>p.person?.name).filter(Boolean).join(', ') || 'none listed'}.`, actions:m.actions??[], commitments:m.commitments??[] };
    }
    if (request.intent === 'MEETING_SUMMARY' && evidence.meetings?.[0]) {
      const m=evidence.meetings[0]; return { type:'meeting_summary', text:m.outcome ?? 'No meeting outcome has been recorded.', evidence:[m.id] };
    }
    if (request.intent === 'ACTION_EXTRACTION' || request.intent === 'COMMITMENT_EXTRACTION') {
      const text=request.query; const sentences=text.split(/[.!?]+/).map(s=>s.trim()).filter(Boolean);
      const candidates=sentences.filter(s=>/\b(will|must|need to|should|todo|follow up|deliver|send|prepare|schedule)\b/i.test(s)).slice(0,20);
      return { type:request.intent.toLowerCase(), candidates, requires_confirmation:true };
    }
    if (request.intent === 'RISK_DETECTION') return { type:'risk_detection', signals: request.query.match(/\b(risk|blocked|delay|late|lost|concern|issue|problem|escalat\w*)\b/gi) ?? [], requires_confirmation:true };
    if (request.intent === 'OPPORTUNITY_DETECTION') return { type:'opportunity_detection', signals: request.query.match(/\b(opportunit\w*|expand|grow|partner|renew|cross[- ]sell|upsell)\b/gi) ?? [], requires_confirmation:true };
    if (request.intent === 'NEXT_BEST_ACTION') return { type:'next_best_action', suggestions:['Review the latest permitted interaction or meeting evidence.','Confirm any detected action/commitment before creating records.'], requires_confirmation:true };
    return { type:'smart_search', matches:evidence };
  }

  async executiveBrief(userId: string, organizationId?: string, weekStart?: string) {
    const orgIds = await this.authorization.accessibleOrganizationIds(userId);
    if (organizationId) { await this.authorization.assertAnyOrganizationAccess(userId, [organizationId]); }
    const scopeIds = organizationId ? [organizationId] : orgIds;
    const start = weekStart ? new Date(weekStart) : new Date(Date.now() - 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const orgFilter:any = scopeIds ? { organizationId: { in: scopeIds } } : {};
    const relFilter:any = scopeIds ? { OR: [{ sourceOrganizationId:{in:scopeIds} }, { targetOrganizationId:{in:scopeIds} }] } : {};
    const [meetings, commitments, overdueActions, relationships, opportunities] = await Promise.all([
      this.prisma.meeting.findMany({where:{deletedAt:null,...orgFilter,startAt:{gte:start,lte:end}},orderBy:{startAt:'asc'},take:20,select:{id:true,title:true,startAt:true,objective:true,organizationId:true}}),
      this.prisma.commitment.findMany({where:{deletedAt:null,...orgFilter,status:{not:'COMPLETED'}},orderBy:{dueAt:'asc'},take:20,select:{id:true,description:true,dueAt:true,status:true,organizationId:true}}),
      this.prisma.action.findMany({where:{deletedAt:null,...orgFilter,dueAt:{lt:new Date()},status:{not:'COMPLETED'}},orderBy:{dueAt:'asc'},take:20,select:{id:true,title:true,dueAt:true,status:true}}),
      this.prisma.relationship.findMany({where:{deletedAt:null,AND:[relFilter,{OR:[{riskScore:{gte:60}},{healthScore:{lte:40}}]}]},orderBy:[{riskScore:'desc'},{healthScore:'asc'}],take:20,select:{id:true,status:true,riskScore:true,healthScore:true,strategicScore:true,nextActionAt:true,sourceOrganizationId:true,targetOrganizationId:true}}),
      this.prisma.opportunity.findMany({where:{deletedAt:null,...orgFilter},orderBy:{createdAt:'desc'},take:20,select:{id:true,name:true,status:true,probability:true,organizationId:true,createdAt:true}}),
    ]);
    const recommendations = [
      overdueActions.length ? `Resolve ${overdueActions.length} overdue action(s) before creating new commitments.` : 'No overdue actions are currently visible.',
      relationships.length ? `Review ${relationships.length} high-risk or low-health relationship(s) and assign next actions.` : 'No high-risk/low-health relationships are currently visible.',
      opportunities.length ? `Prioritize the newest visible opportunities and validate owners and next steps.` : 'No recent opportunities are currently visible.'
    ];
    const result={period:{start:start.toISOString(),end:end.toISOString()},summary:{meetings:meetings.length,newOpportunities:opportunities.length,openCommitments:commitments.length,overdueActions:overdueActions.length,relationshipRisks:relationships.length},importantMeetings:meetings,commitments,overdueActions,risks:relationships,opportunities,recommendations,evidence:{meetingIds:meetings.map(x=>x.id),commitmentIds:commitments.map(x=>x.id),actionIds:overdueActions.map(x=>x.id),relationshipIds:relationships.map(x=>x.id),opportunityIds:opportunities.map(x=>x.id)},generatedAt:new Date().toISOString()};
    await this.audit.logMutation({userId,action:AuditAction.READ,entityType:'AI_EXECUTIVE_BRIEF',reason:`AI executive brief; organizationId=${organizationId??'all-visible'}`});
    this.metrics.observeAi('deterministic-gateway',0,0,JSON.stringify(result).length,0,false);
    await this.prisma.aiUsageEvent.create({data:{userId,organizationId,intent:'EXECUTIVE_BRIEF',provider:'deterministic-gateway',model:'rule-based-v1',inputTokens:0,outputTokens:JSON.stringify(result).length,latencyMs:0,estimatedCost:0,success:true}});
    return {status:'completed',type:'executive_brief',result,model:{provider:'deterministic-gateway',externalCall:false},safety:{permissionAwareRetrieval:true,humanConfirmationRequired:false}};
  }

  async execute(request: AiRequest) {
    if (!request.userId || !request.query?.trim()) throw new ForbiddenException('Invalid AI request');
    const started=Date.now();
    const evidence=await this.retrieve(request);
    const documentEvidence=await this.pipeline.retrieve(request.userId, request.query, request.organizationId);
    const result=this.draft(request,{...evidence,documentChunks:documentEvidence});
    await this.audit.logMutation({ userId:request.userId, action:AuditAction.READ, entityType:'AI_QUERY', entityId:request.meetingId ?? request.relationshipId, reason:`AI intent=${request.intent}; evidence=${JSON.stringify({organizations:evidence.organizations?.length,meetings:evidence.meetings?.length,interactions:evidence.interactions?.length})}` });
    await this.prisma.aiUsageEvent.create({data:{userId:request.userId,organizationId:request.organizationId,intent:request.intent,provider:'deterministic-gateway',model:'rule-based-v1',inputTokens:request.query.length,outputTokens:JSON.stringify(result).length,latencyMs:Date.now()-started,estimatedCost:0,success:true}});
    return { status:'completed_without_external_model', intent:request.intent, evidence, result, model:{provider:'deterministic-gateway', externalCall:false}, safety:{permissionAwareRetrieval:true, humanConfirmationRequired:['ACTION_EXTRACTION','COMMITMENT_EXTRACTION','RISK_DETECTION','OPPORTUNITY_DETECTION','NEXT_BEST_ACTION'].includes(request.intent)} };
  }
}
