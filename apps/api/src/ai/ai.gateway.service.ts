import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditAction, CommitmentStatus, ActionStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AiPipelineService } from './ai-pipeline.service';
import { MetricsService } from '../observability/metrics.service';

export type AiIntent = 'SMART_SEARCH'|'MEETING_BRIEF'|'MEETING_SUMMARY'|'ACTION_EXTRACTION'|'COMMITMENT_EXTRACTION'|'RISK_DETECTION'|'OPPORTUNITY_DETECTION'|'NEXT_BEST_ACTION'|'EXECUTIVE_BRIEF';
export type AiRequest = { userId: string; intent: AiIntent; query: string; organizationId?: string; meetingId?: string; relationshipId?: string; };

const DAY_MS = 86400000;
const STALE_AFTER_DAYS = 60;

@Injectable()
export class AiGatewayService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly pipeline: AiPipelineService, private readonly metrics:MetricsService, private readonly audit: AuditService) {}

  /**
   * Permission-aware retrieval. For conversational/stateful intents the query
   * text is NOT used as a hard substring filter (it would never match natural
   * language); instead real, scoped evidence (interactions, meetings, stale
   * relationships, risky/opportunity relationships) is fetched from the DB so
   * the built-in deterministic logic answers from actual data.
   */
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
    const relScope = scope ? [{ sourceOrganizationId: scope }, { targetOrganizationId: scope }] : [];

    // Stateful intents: answer from real relationship/interaction/meeting state.
    if (request.intent === 'NEXT_BEST_ACTION' || request.intent === 'RISK_DETECTION' || request.intent === 'OPPORTUNITY_DETECTION') {
      const now = new Date();
      const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * DAY_MS);
      const [interactions, upcomingMeetings, staleRelationships, riskyRelationships, opportunityRelationships] = await Promise.all([
        this.prisma.interaction.findMany({ where:{ deletedAt:null, ...(scope?{organizationId:scope}:{}) }, include:{ organization:{select:{id:true,name:true}} }, orderBy:{ occurredAt:'desc' }, take:15 }),
        this.prisma.meeting.findMany({ where:{ deletedAt:null, ...(scope?{organizationId:scope}:{}), startAt:{ gte: now } }, include:{ organization:{select:{id:true,name:true}} }, orderBy:{ startAt:'asc' }, take:15 }),
        this.prisma.relationship.findMany({
          where:{ deletedAt:null, ...(relScope.length?{OR:relScope}:{}), AND:[{ OR:[{ nextActionAt:{ lte: now } },{ lastInteractionAt:{ lt: staleCutoff } },{ lastInteractionAt:null }] }] },
          include:{ sourceOrganization:{select:{id:true,name:true}}, targetOrganization:{select:{id:true,name:true}} },
          orderBy:{ lastInteractionAt:'asc' }, take:15,
        }),
        this.prisma.relationship.findMany({
          where:{ deletedAt:null, ...(relScope.length?{OR:relScope}:{}), AND:[{ OR:[{ riskScore:{ gte:60 } },{ healthScore:{ lte:40 } }] }] },
          include:{ sourceOrganization:{select:{id:true,name:true}}, targetOrganization:{select:{id:true,name:true}} },
          orderBy:[{ riskScore:'desc' },{ healthScore:'asc' }], take:15,
        }),
        this.prisma.relationship.findMany({
          where:{ deletedAt:null, ...(relScope.length?{OR:relScope}:{}), opportunityScore:{ gte:60 }, healthScore:{ gte:45 } },
          include:{ sourceOrganization:{select:{id:true,name:true}}, targetOrganization:{select:{id:true,name:true}} },
          orderBy:{ opportunityScore:'desc' }, take:15,
        }),
      ]);
      const orgs = new Map<string,{id:string;name:string}>();
      for (const ix of interactions) if (ix.organization) orgs.set(ix.organization.id, ix.organization);
      for (const m of upcomingMeetings) if (m.organization) orgs.set(m.organization.id, m.organization);
      return {
        organizations: [...orgs.values()].slice(0,20),
        meetings: upcomingMeetings,
        interactions,
        staleRelationships,
        riskyRelationships,
        opportunityRelationships,
      };
    }

    const [organizations, meetings, interactions] = await Promise.all([
      this.prisma.organization.findMany({ where:{deletedAt:null, ...(scope?{id:scope}:{}), ...(q?{name:{contains:q,mode:'insensitive'}}:{})}, select:{id:true,name:true,type:true}, take:20 }),
      this.prisma.meeting.findMany({ where:{deletedAt:null, ...(scope?{organizationId:scope}:{}), ...(q?{OR:[{title:{contains:q,mode:'insensitive'}},{objective:{contains:q,mode:'insensitive'}}]}:{})}, select:{id:true,title:true,objective:true,outcome:true,startAt:true,organizationId:true}, orderBy:{startAt:'desc'}, take:20 }),
      this.prisma.interaction.findMany({ where:{deletedAt:null, ...(scope?{organizationId:scope}:{}), ...(q?{OR:[{subject:{contains:q,mode:'insensitive'}},{summary:{contains:q,mode:'insensitive'}},{outcome:{contains:q,mode:'insensitive'}}]}:{})}, select:{id:true,subject:true,summary:true,outcome:true,occurredAt:true,organizationId:true}, orderBy:{occurredAt:'desc'}, take:20 })
    ]);
    return { organizations, meetings, interactions };
  }

  private relName(r: any): string {
    return r?.targetOrganization?.name ?? r?.sourceOrganization?.name ?? 'رابطه';
  }

  private daysSince(iso?: string | Date | null): number {
    if (!iso) return 365;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / DAY_MS));
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
    if (request.intent === 'RISK_DETECTION') {
      const textSignals = request.query.match(/\b(risk|blocked|delay|late|lost|concern|issue|problem|escalat\w*)\b/gi) ?? [];
      const relSignals = (evidence.riskyRelationships ?? []).slice(0,8).map((r:any) => {
        const name = this.relName(r);
        if (r.riskScore >= 60 && r.healthScore <= 40) return `ریسک بالا (${r.riskScore}) و سلامت پایین (${r.healthScore}) — «${name}»`;
        if (r.riskScore >= 60) return `ریسک بالا (${r.riskScore}) — «${name}»`;
        return `سلامت پایین (${r.healthScore}) — «${name}»`;
      });
      return { type:'risk_detection', signals:[...new Set([...textSignals, ...relSignals])], requires_confirmation:true };
    }
    if (request.intent === 'OPPORTUNITY_DETECTION') {
      const textSignals = request.query.match(/\b(opportunit\w*|expand|grow|partner|renew|cross[- ]sell|upsell)\b/gi) ?? [];
      const relSignals = (evidence.opportunityRelationships ?? []).slice(0,8).map((r:any) =>
        `فرصت بالا (${r.opportunityScore}) با سلامت ${r.healthScore} — «${this.relName(r)}»`);
      return { type:'opportunity_detection', signals:[...new Set([...textSignals, ...relSignals])], requires_confirmation:true };
    }
    if (request.intent === 'NEXT_BEST_ACTION') {
      const suggestions: string[] = [];
      const seen = new Set<string>();
      const push = (s: string) => { if (!seen.has(s)) { seen.add(s); suggestions.push(s); } };
      const now = Date.now();
      for (const r of (evidence.staleRelationships ?? []).slice(0,8)) {
        const name = this.relName(r);
        if (r.nextActionAt && new Date(r.nextActionAt).getTime() <= now) push(`پیگیری «${name}» — اقدام بعدی موعدش رسیده است.`);
        else push(`برنامه‌ریزی تعامل با «${name}» — آخرین تعامل ${this.daysSince(r.lastInteractionAt)} روز پیش ثبت شده است.`);
      }
      const meetingSeen = new Set<string>();
      for (const m of (evidence.meetings ?? []).filter((mm:any) => !mm.outcome)) {
        if (meetingSeen.has(m.title)) continue;
        meetingSeen.add(m.title);
        push(`ثبت نتیجهٔ جلسهٔ «${m.title}» — هنوز نتیجه‌ای ثبت نشده است.`);
        if (suggestions.filter(s => s.startsWith('ثبت نتیجهٔ')).length >= 3) break;
      }
      const orgSeen = new Set<string>();
      for (const ix of (evidence.interactions ?? [])) {
        const orgName = ix.organization?.name;
        const key = orgName ?? 'other';
        if (orgSeen.has(key)) continue;
        orgSeen.add(key);
        push(`ادامهٔ گفتگو با ${orgName ? `«${orgName}»` : 'طرفِ آخرین تعامل'} — بر اساس تعامل ${new Date(ix.occurredAt).toLocaleDateString('fa-IR')}.`);
        if (suggestions.filter(s => s.startsWith('ادامهٔ گفتگو')).length >= 3) break;
      }
      if (!suggestions.length) suggestions.push('همهٔ روابط به‌روز هستند؛ یک تعامل یا جلسهٔ جدید برنامه‌ریزی کنید.');
      return { type:'next_best_action', suggestions: suggestions.slice(0,10), requires_confirmation:true };
    }
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
      this.prisma.commitment.findMany({where:{deletedAt:null,...orgFilter,status:{notIn:[CommitmentStatus.FULFILLED,CommitmentStatus.CANCELLED]}},orderBy:{dueAt:'asc'},take:20,select:{id:true,description:true,dueAt:true,status:true,organizationId:true}}),
      this.prisma.action.findMany({where:{deletedAt:null,...orgFilter,dueAt:{lt:new Date()},status:{notIn:[ActionStatus.DONE,ActionStatus.CANCELLED]}},orderBy:{dueAt:'asc'},take:20,select:{id:true,title:true,dueAt:true,status:true}}),
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
