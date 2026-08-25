import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { SYSTEM_USER_ID } from '../common/system-actor';
import { EntityResponseDto } from '../common/dto/entity-response.dto';
import { EventBusService } from '../event-bus/event-bus.service';
import { PerformanceCacheService } from '../common/performance/performance-cache.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly cache: PerformanceCacheService, private readonly eventBus?: EventBusService) {}
  status(){return {module:'analytics',status:'implemented',metrics:['activeUsers','featureUsage','recommendationAcceptance','successfulConnections','relationshipUpdates','organizations','people','relationships','meetings','actions','commitments','projects','opportunities','searches','notifications','workflowExecutions']}}
  private async scope(userId:string){return this.authorization.accessibleOrganizationIds(userId)}
  async summary(userId:string){
    const cacheKey = `perf:dashboard:summary:${userId}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return { ...cached, cached: true };
    const ids=await this.scope(userId); const orgFilter=ids?{organizationId:{in:ids}}:{}; const relFilter=ids?{OR:[{sourceOrganizationId:{in:ids}},{targetOrganizationId:{in:ids}}]}:{};
    const [organizations,people,relationships,meetings,actions,commitments,projects,opportunities,notifications,workflowExecutions,unreadNotifications,activeUsers,featureUsage,recommendationAcceptance,successfulConnections,relationshipUpdates]=await Promise.all([
      this.prisma.organization.count({where:{deletedAt:null,...(ids?{id:{in:ids}}:{})}}),
      this.prisma.person.count({where:{deletedAt:null,...orgFilter}}),
      this.prisma.relationship.count({where:{deletedAt:null,...relFilter}}),
      this.prisma.meeting.count({where:{deletedAt:null,...orgFilter}}),
      this.prisma.action.count({where:{deletedAt:null, ...(ids?{OR:[{relationship:{sourceOrganizationId:{in:ids}}},{relationship:{targetOrganizationId:{in:ids}}},{project:{organizationId:{in:ids}}},{ownerId:userId}]}:{ownerId:userId})}}),
      this.prisma.commitment.count({where:{deletedAt:null, ...(ids?{OR:[{relationship:{sourceOrganizationId:{in:ids}}},{relationship:{targetOrganizationId:{in:ids}}},{ownerId:userId}]}:{ownerId:userId})}}),
      this.prisma.project.count({where:{deletedAt:null,...orgFilter}}),
      this.prisma.opportunity.count({where:{deletedAt:null,...orgFilter}}),
      this.prisma.notification.count({where:{deletedAt:null,userId}}),
      this.prisma.workflowExecution.count({where:{workflow:{organizationId:ids?{in:ids}:undefined}}}),
      this.prisma.notification.count({where:{deletedAt:null,userId,readAt:null}}),
      this.prisma.$queryRaw<Array<{count:number}>>(ids
        ? Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS count FROM "AnalyticsEvent" WHERE "createdAt" >= ${new Date(Date.now()-30*86400000)} AND ("organizationId" IN (${Prisma.join(ids)}) OR "organizationId" IS NULL)`
        : Prisma.sql`SELECT COUNT(DISTINCT "userId")::int AS count FROM "AnalyticsEvent" WHERE "createdAt" >= ${new Date(Date.now()-30*86400000)}`),
      this.prisma.analyticsEvent.groupBy({by:['feature'],where:{createdAt:{gte:new Date(Date.now()-30*86400000)},...(ids?{OR:[{organizationId:{in:ids}},{organizationId:null}]}:{})},_count:{_all:true},orderBy:{_count:{feature:'desc'}},take:20}),
      this.prisma.analyticsEvent.count({where:{type:'RECOMMENDATION_ACCEPTED',...(ids?{organizationId:{in:ids}}:{})}}),
      this.prisma.analyticsEvent.count({where:{type:'SUCCESSFUL_CONNECTION',...(ids?{organizationId:{in:ids}}:{})}}),
      this.prisma.analyticsEvent.count({where:{type:'RELATIONSHIP_UPDATED',...(ids?{organizationId:{in:ids}}:{})}}),
    ]);
    const result = {generatedAt:new Date().toISOString(),windowDays:30,counts:{organizations,people,relationships,meetings,actions,commitments,projects,opportunities,notifications,unreadNotifications,workflowExecutions},engagement:{activeUsers30d:Number(activeUsers[0]?.count ?? 0),featureUsage:featureUsage.map(x=>({feature:x.feature,count:x._count._all})),recommendationAcceptance,recommendationAcceptanceRate:0,successfulConnections,relationshipUpdates}};
    await this.cache.set(cacheKey, result, 30);
    return result;
  }
  async recommendationFunnel(userId: string, from?: Date, to?: Date) {
    const ids = await this.scope(userId);
    const end = to ?? new Date();
    const start = from ?? new Date(end.getTime() - 30 * 86400000);
    if (start >= end) throw new ForbiddenException('Invalid analytics time window');

    const rows: Array<{ type: string; count: bigint }> = await this.prisma.$queryRaw(ids
      ? Prisma.sql`SELECT "type", COUNT(DISTINCT ("metadata"->>'recommendationId')) AS count FROM "AnalyticsEvent" WHERE "feature" = 'recommendation_funnel' AND "createdAt" >= ${start} AND "createdAt" < ${end} AND ("metadata"->>'recommendationId') IS NOT NULL AND "organizationId" IN (${Prisma.join(ids)}) GROUP BY "type"`
      : Prisma.sql`SELECT "type", COUNT(DISTINCT ("metadata"->>'recommendationId')) AS count FROM "AnalyticsEvent" WHERE "feature" = 'recommendation_funnel' AND "createdAt" >= ${start} AND "createdAt" < ${end} AND ("metadata"->>'recommendationId') IS NOT NULL GROUP BY "type"`);

    const counts = Object.fromEntries(rows.map((r) => [r.type, Number(r.count)]));
    const viewed = counts.RECOMMENDATION_VIEWED ?? 0;
    const accepted = counts.RECOMMENDATION_ACCEPTED ?? 0;
    const actionCreated = counts.RECOMMENDATION_ACTION_CREATED ?? 0;
    const actionCompleted = counts.RECOMMENDATION_ACTION_COMPLETED ?? 0;
    const outcome = counts.RECOMMENDATION_OUTCOME ?? 0;
    const rate = (num: number, den: number) => den === 0 ? 0 : Number(((num / den) * 100).toFixed(2));

    return {
      generatedAt: new Date().toISOString(),
      from: start.toISOString(),
      to: end.toISOString(),
      stages: { viewed, accepted, actionCreated, actionCompleted, outcome },
      conversion: {
        viewedToAcceptedPct: rate(accepted, viewed),
        acceptedToActionCreatedPct: rate(actionCreated, accepted),
        actionCreatedToCompletedPct: rate(actionCompleted, actionCreated),
        completedToOutcomePct: rate(outcome, actionCompleted),
      },
      overall: {
        acceptedPct: rate(accepted, viewed),
        actionCreatedPct: rate(actionCreated, viewed),
        actionCompletedPct: rate(actionCompleted, viewed),
        outcomePct: rate(outcome, viewed),
      },
    };
  }

  async recordRecommendationOutcome(userId: string, recommendationId: string, outcome: string, outcomeValue?: unknown) {
    if (!outcome?.trim()) throw new ForbiddenException('outcome is required');
    const rec = await this.prisma.recommendation.findUnique({ where: { id: recommendationId }, select: { id: true, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
    if (!rec) throw new ForbiddenException('Recommendation not found');
    const organizationIds = [rec.relationship?.sourceOrganizationId, rec.relationship?.targetOrganizationId].filter(Boolean) as string[];
    if (organizationIds.length) await this.authorization.assertAnyOrganizationAccess(userId, organizationIds);
    if (!this.eventBus) throw new ForbiddenException('Analytics event bus is unavailable');
    return this.eventBus.transaction(async (tx) => {
      const event = await this.eventBus!.publishInTransaction(tx, {
        eventType: DOMAIN_EVENT_TYPES.RECOMMENDATION_OUTCOME,
        aggregateType: 'Recommendation',
        aggregateId: recommendationId,
        organizationId: rec.relationship?.sourceOrganizationId,
        actorId: userId,
        payload: { recommendationId, outcome: outcome.trim(), outcomeValue },
      });
      await tx.analyticsEvent.create({
        data: {
          userId,
          type: 'RECOMMENDATION_OUTCOME',
          feature: 'recommendation_funnel',
          organizationId: rec.relationship?.sourceOrganizationId,
          metadata: { recommendationId, domainEventId: event.id, outcome: outcome.trim(), outcomeValue },
        },
      });
      return { recorded: true, eventId: event.id, recommendationId, outcome: outcome.trim() };
    });
  }


  async strategicNetworkMetrics(userId:string, organizationId?:string) {
    const ids = await this.scope(userId);
    if (organizationId) await this.authorization.assertAnyOrganizationAccess(userId,[organizationId]);
    const orgIds = organizationId ? [organizationId] : ids;
    const relWhere:any = { deletedAt:null, ...(orgIds ? { OR:[{sourceOrganizationId:{in:orgIds}},{targetOrganizationId:{in:orgIds}}] } : {}) };
    const oppWhere:any = { deletedAt:null, ...(orgIds ? {organizationId:{in:orgIds}} : {}) };
    const refWhere:any = { deletedAt:null, ...(orgIds ? {OR:[{sourceOrganizationId:{in:orgIds}},{targetOrganizationId:{in:orgIds}}]} : {}) };
    const [relAgg,relCount,oppAgg,oppCount,people,refGroups,networkDistinct] = await Promise.all([
      this.prisma.relationship.aggregate({where:relWhere,_avg:{healthScore:true,strategicScore:true,trustScore:true,influenceScore:true,accessScore:true,opportunityScore:true,resilienceScore:true,riskScore:true,engagementScore:true}}),
      this.prisma.relationship.count({where:relWhere}),
      this.prisma.opportunity.aggregate({where:oppWhere,_sum:{value:true},_avg:{probability:true}}),
      this.prisma.opportunity.count({where:oppWhere}),
      this.prisma.person.count({where:{deletedAt:null,...(orgIds?{organizationId:{in:orgIds}}:{})}}),
      this.prisma.referral.groupBy({by:['status'],where:refWhere,_count:{_all:true}}),
      this.prisma.$queryRaw<Array<{organizations:number|string}>>(orgIds
        ? Prisma.sql`SELECT COUNT(DISTINCT org_id) AS organizations FROM (SELECT "sourceOrganizationId" AS org_id FROM "Relationship" WHERE "deletedAt" IS NULL AND ("sourceOrganizationId" IN (${Prisma.join(orgIds)}) OR "targetOrganizationId" IN (${Prisma.join(orgIds)})) UNION SELECT "targetOrganizationId" AS org_id FROM "Relationship" WHERE "deletedAt" IS NULL AND ("sourceOrganizationId" IN (${Prisma.join(orgIds)}) OR "targetOrganizationId" IN (${Prisma.join(orgIds)}))) q`
        : Prisma.sql`SELECT COUNT(DISTINCT org_id) AS organizations FROM (SELECT "sourceOrganizationId" AS org_id FROM "Relationship" WHERE "deletedAt" IS NULL UNION SELECT "targetOrganizationId" AS org_id FROM "Relationship" WHERE "deletedAt" IS NULL) q`),
    ]);
    const quality=((relAgg._avg.healthScore??0)+(relAgg._avg.trustScore??0)+(relAgg._avg.accessScore??0))/3;
    const influence=relAgg._avg.influenceScore??0, resilience=relAgg._avg.resilienceScore??0, strategic=relAgg._avg.strategicScore??0, opportunityPotential=relAgg._avg.opportunityScore??0, risk=relAgg._avg.riskScore??0, engagement=relAgg._avg.engagementScore??0;
    const organizationsCovered = Number(networkDistinct[0]?.organizations ?? 0);
    const coverage = orgIds ? Math.min(100, Math.round((organizationsCovered/Math.max(1,orgIds.length))*100)) : 0;
    const diversity = relCount ? Math.min(100, Math.round((organizationsCovered/Math.max(1,relCount))*100)) : 0;
    const weightedOpportunityValue = Number(oppAgg._sum.value??0) * (Number(oppAgg._avg.probability??0)/100);
    const avg=(v:number[])=>v.length?v.reduce((a,b)=>a+b,0)/v.length:0;
    const capital=Math.round(avg([quality,influence,strategic,opportunityPotential,resilience,coverage,diversity,engagement,100-risk]));
    const sri=Math.round(avg([coverage,quality,influence,opportunityPotential,resilience]));
    const referralTotal=refGroups.reduce((n,g)=>n+g._count._all,0); const referralSuccess=refGroups.find(g=>g.status==='COMPLETED')?._count._all??0;
    return {generatedAt:new Date().toISOString(),organizationId:organizationId??null,relationshipCount:relCount,peopleCount:people,opportunityCount:oppCount,networkCapital:{score:capital,components:{relationshipQuality:Math.round(quality),influence:Math.round(influence),strategicValue:Math.round(strategic),opportunityPotential:Math.round(opportunityPotential),resilience:Math.round(resilience),coverage,diversity,engagement:Math.round(engagement),riskAdjusted:Math.round(100-risk)}},strategicRelationshipIndex:{score:sri,breakdown:{coverage,strength:Math.round(quality),influence:Math.round(influence),opportunity:Math.round(opportunityPotential),resilience:Math.round(resilience)}},relationshipResilienceScore:Math.round(resilience),weightedOpportunityValue,referralSuccessRate:{total:referralTotal,successful:referralSuccess,rate:referralTotal?Number((referralSuccess/referralTotal*100).toFixed(2)):0},bounded:true};
  }

  async workflow(userId:string){const ids=await this.scope(userId);const groups=await this.prisma.workflowExecution.groupBy({by:['status'],where:{workflow:{organizationId:ids?{in:ids}:undefined}},_count:{_all:true}});return {generatedAt:new Date().toISOString(),executions:groups.map(g=>({status:g.status,count:g._count._all}))}}
  async record(userId:string, body:any){
    const organizationId=body.organizationId as string|undefined; if(organizationId) await this.authorization.assertAnyOrganizationAccess(userId,[organizationId]);
    if(!body.type||!body.feature) throw new ForbiddenException('type and feature are required');
    return EntityResponseDto.fromUnknown(await this.prisma.analyticsEvent.create({data:{userId,type:body.type,feature:body.feature,organizationId,metadata:body.metadata??undefined}}));
  }

  /**
   * محاسبه واقعی و سیستمی متریک‌های تجمیعی (بدون هیچ وابستگی بیرونی):
   * برای هر Organization فعال، تعداد رابطه‌های در معرض خطر (healthScore<50)،
   * تعهدات عقب‌افتاده، و اقدامات عقب‌افتاده را می‌شمارد و به‌صورت یک
   * AnalyticsEvent از نوع DASHBOARD_SNAPSHOT ذخیره می‌کند تا Dashboard/Report
   * بتواند بدون Query سنگین در لحظه، از آخرین Snapshot استفاده کند.
   * توسط Job زمان‌بندی‌شده (نه به‌صورت دستی) فراخوانی می‌شود.
   */
  async recompute(actorId: string = SYSTEM_USER_ID) {
    type Snapshot = { organizationId:string; atRiskRelationships:number|string; overdueCommitments:number|string; overdueActions:number|string; openOpportunities:number|string };
    const rows = await this.prisma.$queryRaw<Snapshot[]>`
      WITH orgs AS (SELECT id FROM "Organization" WHERE "deletedAt" IS NULL AND status = 'ACTIVE'),
      risks AS (SELECT o.id, COUNT(r.id) AS c FROM orgs o LEFT JOIN "Relationship" r ON r."deletedAt" IS NULL AND r."healthScore" < 50 AND (r."sourceOrganizationId"=o.id OR r."targetOrganizationId"=o.id) GROUP BY o.id),
      commits AS (SELECT o.id, COUNT(c.id) AS c FROM orgs o LEFT JOIN "Commitment" c ON c."deletedAt" IS NULL AND c.status='OVERDUE' AND (c."organizationId"=o.id OR EXISTS (SELECT 1 FROM "Relationship" r WHERE r.id=c."relationshipId" AND (r."sourceOrganizationId"=o.id OR r."targetOrganizationId"=o.id))) GROUP BY o.id),
      actions AS (SELECT o.id, COUNT(a.id) AS c FROM orgs o LEFT JOIN "Action" a ON a."deletedAt" IS NULL AND a.status IN ('OPEN','IN_PROGRESS') AND a."dueAt" < NOW() AND EXISTS (SELECT 1 FROM "Relationship" r WHERE r.id=a."relationshipId" AND (r."sourceOrganizationId"=o.id OR r."targetOrganizationId"=o.id)) GROUP BY o.id),
      opps AS (SELECT o.id, COUNT(p.id) AS c FROM orgs o LEFT JOIN "Opportunity" p ON p."deletedAt" IS NULL AND p.status NOT IN ('WON','LOST') AND p."organizationId"=o.id GROUP BY o.id)
      SELECT o.id AS "organizationId", risks.c AS "atRiskRelationships", commits.c AS "overdueCommitments", actions.c AS "overdueActions", opps.c AS "openOpportunities" FROM orgs o JOIN risks ON risks.id=o.id JOIN commits ON commits.id=o.id JOIN actions ON actions.id=o.id JOIN opps ON opps.id=o.id`;
    if(!rows.length) return {organizationsProcessed:0};
    const computedAt=new Date().toISOString();
    await this.prisma.analyticsEvent.createMany({data:rows.map(r=>({userId:actorId,type:'DASHBOARD_SNAPSHOT',feature:'analytics_recompute',organizationId:r.organizationId,metadata:{atRiskRelationships:Number(r.atRiskRelationships),overdueCommitments:Number(r.overdueCommitments),overdueActions:Number(r.overdueActions),openOpportunities:Number(r.openOpportunities),computedAt}}))});
    return {organizationsProcessed:rows.length,batched:true,completedAt:computedAt};
  }

}
