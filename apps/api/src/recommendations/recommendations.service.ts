import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Priority } from '@prisma/client';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

export const RECOMMENDATION_TYPES = [
  'FOLLOW_UP','MEETING','INTRODUCTION','RELATIONSHIP_REPAIR','DIVERSIFICATION',
  'OPPORTUNITY','RISK_MITIGATION','PROJECT_CONNECTION','EXECUTIVE_ESCALATION',
] as const;
export type RecommendationType = typeof RECOMMENDATION_TYPES[number];
export type RecommendationStatus = 'PROPOSED'|'APPROVED'|'REJECTED'|'SNOOZED'|'ASSIGNED'|'EXECUTED'|'ARCHIVED';

const clamp = (n:number) => Math.max(0, Math.min(100, Math.round(n)));

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly eventBus: EventBusService) {}

  status() { return { module: 'recommendations', status: 'implemented', types: RECOMMENDATION_TYPES, humanApproval: true, explainability: true }; }

  private async relationshipScope(userId:string, relationshipId:string) {
    const r = await this.prisma.relationship.findFirst({ where:{ id:relationshipId, deletedAt:null } });
    if (!r) throw new NotFoundException('Relationship not found');
    await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: r.sourceOrganizationId });
    await this.authorization.assertPermission(userId, 'relationship.read', { organizationId: r.targetOrganizationId });
    return EntityResponseDto.fromUnknown(r);
  }

  private async recommendationScope(userId:string, id:string) {
    const rec = await this.prisma.recommendation.findFirst({ where:{ id, deletedAt:null }, include:{ relationship:true } });
    if (!rec) throw new NotFoundException('Recommendation not found');
    if (rec.relationship) await this.relationshipScope(userId,rec.relationship.id);
    else await this.authorization.assertPermission(userId, 'recommendation.read', {});
    return EntityResponseDto.fromUnknown(rec);
  }

  async list(userId:string, status?:RecommendationStatus, type?:RecommendationType) {
    await this.authorization.assertPermission(userId, 'recommendation.read', {});
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const rows = await this.prisma.recommendation.findMany({
      where:{ deletedAt:null, ...(status?{status}:{}), ...(type?{type}:{}), ...(ids?{ OR:[{relationship:{sourceOrganizationId:{in:ids}}},{relationship:{targetOrganizationId:{in:ids}}},{relationshipId:null,userId}]}:{}) },
      include:{ relationship:{ include:{sourceOrganization:{select:{id:true,name:true}},targetOrganization:{select:{id:true,name:true}}} } },
      orderBy:[{status:'asc'},{confidence:'desc'},{createdAt:'desc'}], take:200,
    });
    return EntityResponseDto.fromUnknown(rows);
  }

  async get(userId:string,id:string){ return this.recommendationScope(userId,id); }

  private candidateKey(type:RecommendationType, relationshipId?:string, targetId?:string){ return `${type}:${relationshipId ?? ''}:${targetId ?? ''}`; }

  private async exists(userId:string, type:RecommendationType, relationshipId?:string, targetId?:string){
    const existing = await this.prisma.recommendation.findFirst({ where:{ type, relationshipId:relationshipId ?? null, targetId:targetId ?? null, deletedAt:null, status:{in:['PROPOSED','ASSIGNED','SNOOZED','APPROVED']} } });
    if (!existing) return false;
    if (relationshipId) await this.relationshipScope(userId,relationshipId);
    return true;
  }

  private async createCandidate(userId:string,input:{type:RecommendationType;relationshipId?:string;targetId?:string;title:string;rationale:string;confidence:number;evidence:Record<string,unknown>}){let organizationId:string|undefined;if(input.relationshipId){const r=await this.relationshipScope(userId,input.relationshipId);await this.authorization.assertPermission(userId,'recommendation.write',{organizationId:r.sourceOrganizationId});organizationId=r.sourceOrganizationId;}else await this.authorization.assertPermission(userId,'recommendation.write',{});if(await this.exists(userId,input.type,input.relationshipId,input.targetId))return null;const created=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.create({data:{userId,relationshipId:input.relationshipId,targetId:input.targetId,type:input.type,title:input.title,rationale:input.rationale,confidence:clamp(input.confidence),status:'PROPOSED',evidence:input.evidence}});await this.audit.logMutation({userId,action:'CREATE',entityType:'Recommendation',entityId:row.id,organizationId,after:row,reason:'recommendation-generated'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_CREATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(created);}

  async generate(userId:string, organizationId?:string) {
    await this.authorization.assertPermission(userId, 'recommendation.write', { organizationId: organizationId });
    const ids = await this.authorization.accessibleOrganizationIds(userId);
    const scope = organizationId ? [organizationId] : ids;
    const relationships = await this.prisma.relationship.findMany({
      where:{deletedAt:null, ...(scope?{OR:[{sourceOrganizationId:{in:scope}},{targetOrganizationId:{in:scope}}]}:{})},
      include:{ sourceOrganization:{select:{id:true,name:true}}, targetOrganization:{select:{id:true,name:true}} }, take:500,
    });
    const now=Date.now(); const created:any[]=[];
    for (const r of relationships) {
      const daysSince = r.lastInteractionAt ? (now-r.lastInteractionAt.getTime())/86400000 : 365;
      const hasFollowUp = !!r.nextActionAt && r.nextActionAt.getTime() <= now;
      if (hasFollowUp || daysSince >= 90) {
        const rec=await this.createCandidate(userId,{type:'FOLLOW_UP',relationshipId:r.id,title:`Follow up with ${r.targetOrganization.name}`,rationale:hasFollowUp?'The next action is due.':`No recent interaction has been recorded for ${Math.round(daysSince)} days.`,confidence:clamp(55+Math.min(35,daysSince/4)+(hasFollowUp?10:0)),evidence:{daysSinceLastInteraction:Math.round(daysSince),nextActionAt:r.nextActionAt}}); if(rec)created.push(rec);
      }
      if (r.strategicScore >= 70 && daysSince >= 60) {
        const rec=await this.createCandidate(userId,{type:'MEETING',relationshipId:r.id,title:`Schedule a strategic meeting with ${r.targetOrganization.name}`,rationale:'High strategic value combined with stale executive engagement.',confidence:clamp(65+r.strategicScore*0.2),evidence:{strategicScore:r.strategicScore,daysSinceLastInteraction:Math.round(daysSince)}}); if(rec)created.push(rec);
      }
      if (r.riskScore >= 65 || r.healthScore <= 40) {
        const rec=await this.createCandidate(userId,{type:'RISK_MITIGATION',relationshipId:r.id,title:`Mitigate relationship risk with ${r.targetOrganization.name}`,rationale:'Relationship risk or low health requires review and corrective action.',confidence:clamp(60+r.riskScore*0.3+(r.healthScore<=40?10:0)),evidence:{riskScore:r.riskScore,healthScore:r.healthScore,resilienceScore:r.resilienceScore}}); if(rec)created.push(rec);
      }
      if (r.resilienceScore <= 40 && r.influenceScore >= 50) {
        const rec=await this.createCandidate(userId,{type:'DIVERSIFICATION',relationshipId:r.id,title:`Diversify relationship coverage for ${r.targetOrganization.name}`,rationale:'Low resilience indicates concentration risk in the current relationship.',confidence:clamp(60+(50-r.resilienceScore)*0.4),evidence:{resilienceScore:r.resilienceScore,influenceScore:r.influenceScore}}); if(rec)created.push(rec);
      }
      if (r.opportunityScore >= 60 && r.healthScore >= 45) {
        const rec=await this.createCandidate(userId,{type:'OPPORTUNITY',relationshipId:r.id,title:`Explore opportunity with ${r.targetOrganization.name}`,rationale:'Opportunity potential is high and relationship health is sufficient to act.',confidence:clamp((r.opportunityScore+r.healthScore+r.strategicScore)/3),evidence:{opportunityScore:r.opportunityScore,healthScore:r.healthScore,strategicScore:r.strategicScore}}); if(rec)created.push(rec);
      }
      if (r.strategicScore >= 85 && r.lastInteractionAt && daysSince >= 120) {
        const rec=await this.createCandidate(userId,{type:'EXECUTIVE_ESCALATION',relationshipId:r.id,title:`Executive review for ${r.targetOrganization.name}`,rationale:'A strategically important relationship has lacked meaningful interaction for an extended period.',confidence:clamp(75+(r.strategicScore-85)),evidence:{strategicScore:r.strategicScore,daysSinceLastInteraction:Math.round(daysSince)}}); if(rec)created.push(rec);
      }
    }
    return { generated:created.length, recommendations:created, candidateTypes:RECOMMENDATION_TYPES };
  }

  async approve(userId:string,id:string){const rec=await this.recommendationScope(userId,id);if(!['PROPOSED','SNOOZED','ASSIGNED'].includes(rec.status))throw new BadRequestException('Recommendation is not approvable');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{status:'APPROVED',decisionById:userId,decisionAt:new Date(),snoozedUntil:null}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:rec,after:row,reason:'human-approval'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(updated);}

  async reject(userId:string,id:string){const rec=await this.recommendationScope(userId,id);if(['REJECTED','EXECUTED','ARCHIVED'].includes(rec.status))throw new BadRequestException('Recommendation cannot be rejected');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{status:'REJECTED',decisionById:userId,decisionAt:new Date()}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:rec,after:row,reason:'human-rejection'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(updated);}

  async edit(userId:string,id:string,patch:{title?:string;rationale?:string;confidence?:number;evidence?:Record<string,unknown>}){const rec=await this.recommendationScope(userId,id);if(['REJECTED','EXECUTED','ARCHIVED'].includes(rec.status))throw new BadRequestException('Recommendation cannot be edited');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{...patch,confidence:patch.confidence===undefined?undefined:clamp(patch.confidence),editedAt:new Date()}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:rec,after:row,reason:'human-edit'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(updated);}

  async snooze(userId:string,id:string,until:Date){if(until.getTime()<=Date.now())throw new BadRequestException('Snooze time must be in the future');const rec=await this.recommendationScope(userId,id);const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{status:'SNOOZED',snoozedUntil:until}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:rec,after:row,reason:'human-snooze'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(updated);}

  async assign(userId:string,id:string,assignedToId:string){const rec=await this.recommendationScope(userId,id);const org=rec.relationship?.sourceOrganizationId;if(org)await this.authorization.assertPermission(userId,'recommendation.write',{organizationId:org});const assignee=await this.prisma.user.findUnique({where:{id:assignedToId},select:{id:true,isActive:true,deletedAt:true}});if(!assignee?.isActive||assignee.deletedAt)throw new BadRequestException('Assignee is not active');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{assignedToId,status:'ASSIGNED'}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:org,before:rec,after:row,reason:'recommendation-assigned'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:row.id,organizationId:org,actorId:userId,payload:row as any});return row;});return EntityResponseDto.fromUnknown(updated);}

  async execute(userId:string,id:string){const rec=await this.recommendationScope(userId,id);if(rec.status!=='APPROVED')throw new BadRequestException('Recommendation must be approved before execution');if(!rec.relationshipId)throw new BadRequestException('Executable recommendation requires a relationship');const r=rec.relationship!;await this.authorization.assertPermission(userId,'action.write',{organizationId:r.sourceOrganizationId});return this.eventBus.transaction(async tx=>{const action=await tx.action.create({data:{title:rec.title,ownerId:rec.assignedToId??userId,relationshipId:r.id,recommendationId:id,priority:rec.type==='RISK_MITIGATION'?Priority.HIGH:rec.type==='EXECUTIVE_ESCALATION'?Priority.CRITICAL:Priority.MEDIUM,dueAt:new Date(Date.now()+7*86400000)}});await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.ACTION_CREATED,aggregateType:'Action',aggregateId:action.id,organizationId:r.sourceOrganizationId,actorId:userId,payload:action as any});await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_ACTION_CREATED,aggregateType:'Recommendation',aggregateId:id,organizationId:r.sourceOrganizationId,actorId:userId,payload:{recommendationId:id,actionId:action.id}});const updated=await tx.recommendation.update({where:{id},data:{status:'EXECUTED',decisionById:userId,decisionAt:new Date()}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:r.sourceOrganizationId,before:rec,after:{recommendation:updated,actionId:action.id},reason:'recommendation-executed'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:updated.id,organizationId:r.sourceOrganizationId,actorId:userId,payload:{recommendation:updated,actionId:action.id} as any});return {recommendation:updated,action};});}

  async view(userId:string,id:string){const rec=await this.recommendationScope(userId,id);await this.eventBus.transaction(async tx=>{await this.audit.logMutation({userId,action:'READ',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:{status:rec.status},after:{status:rec.status},reason:'recommendation-viewed'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_VIEWED,aggregateType:'Recommendation',aggregateId:id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:{recommendationId:id}});});return rec;}

  async accept(userId:string,id:string){const rec=await this.recommendationScope(userId,id);if(!['PROPOSED','SNOOZED','ASSIGNED'].includes(rec.status))throw new BadRequestException('Recommendation is not acceptable');const updated=await this.eventBus.transaction(async tx=>{const row=await tx.recommendation.update({where:{id},data:{status:'APPROVED',decisionById:userId,decisionAt:new Date(),snoozedUntil:null}});await this.audit.logMutation({userId,action:'UPDATE',entityType:'Recommendation',entityId:id,organizationId:rec.relationship?.sourceOrganizationId,before:rec,after:row,reason:'recommendation-accepted'},tx);await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_UPDATED,aggregateType:'Recommendation',aggregateId:id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:row as any});await this.eventBus.publishInTransaction(tx,{eventType:DOMAIN_EVENT_TYPES.RECOMMENDATION_ACCEPTED,aggregateType:'Recommendation',aggregateId:id,organizationId:rec.relationship?.sourceOrganizationId,actorId:userId,payload:{before:rec.status,after:row.status}});return row;});return EntityResponseDto.fromUnknown(updated);}

  async explain(userId:string,id:string){
    const rec=await this.recommendationScope(userId,id); return {id:rec.id,type:rec.type,confidence:rec.confidence,reason:rec.rationale,evidence:rec.evidence,relationshipId:rec.relationshipId,status:rec.status,explainability:{factors:rec.evidence,decision:rec.rationale,humanApprovalRequired:true}};
  }
}
