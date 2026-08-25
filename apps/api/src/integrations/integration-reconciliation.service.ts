import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationKind, ExternalEvent } from './integration-provider.port';
import { DataLifecycleService } from '../common/data-lifecycle/data-lifecycle.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

@Injectable()
export class IntegrationReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly lifecycle: DataLifecycleService) {}

  private normEmail(v?: string){return v?.trim().toLowerCase()||null;}
  private emails(event:ExternalEvent){return [...new Set([...(event.attendees||[]),...(event.recipients||[]),event.sender||''].map(x=>this.normEmail(x)).filter(Boolean) as string[])];}

  private async peopleFor(event:ExternalEvent){
    const emails=this.emails(event); if(!emails.length) return [];
    return EntityResponseDto.manyUnknown(await this.prisma.person.findMany({where:{email:{in:emails},deletedAt:null},select:{id:true,email:true,organizationId:true,firstName:true,lastName:true}}));
  }

  private async relationshipFor(orgA?:string|null, orgB?:string|null){
    if(!orgA||!orgB) return null;
    return EntityResponseDto.fromUnknown(await this.prisma.relationship.findFirst({where:{deletedAt:null,OR:[{sourceOrganizationId:orgA,targetOrganizationId:orgB},{sourceOrganizationId:orgB,targetOrganizationId:orgA}]},orderBy:{updatedAt:'desc'}}));
  }

  async reconcile(connectionId:string,userId:string,organizationId:string|undefined,events:ExternalEvent[],runId:string){
    const summary={seen:0,created:0,updated:0,cancelled:0,matchedPeople:0,matchedOrganizations:0,linkedRelationships:0,errors:[] as string[]};
    for(const event of events){
      summary.seen++;
      try{
        const people=await this.peopleFor(event); summary.matchedPeople+=people.length; summary.matchedOrganizations += new Set(people.map(p=>p.organizationId)).size;
        const personIds=people.map(p=>p.id); const orgIds=[...new Set(people.map(p=>p.organizationId))];
        const targetOrg=organizationId||orgIds[0];
        const rel=targetOrg?await this.relationshipFor(targetOrg,orgIds.find(x=>x!==targetOrg)):null; if(rel)summary.linkedRelationships++;
        const existing=await this.prisma.integrationExternalRecord.findUnique({where:{connectionId_kind_externalId:{connectionId,kind:event.kind,externalId:event.externalId}}});
        if(event.kind==='CALENDAR'){
          let meetingId=existing?.meetingId;
          if(event.cancelled){
            if(meetingId) await this.lifecycle.softDelete(userId,'Meeting',meetingId,'integration-event-cancelled');
            if(existing) await this.prisma.integrationExternalRecord.update({where:{id:existing.id},data:{status:'CANCELLED',cancelledAt:new Date(),externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,payload:event.raw as any}});
            summary.cancelled++; continue;
          }
          const owner=await this.prisma.user.findUnique({where:{id:userId},select:{id:true}}); if(!owner) throw new Error('Integration owner not found');
          const data={title:event.title||'Imported meeting',startAt:event.startsAt?new Date(event.startsAt):new Date(),endAt:event.endsAt?new Date(event.endsAt):undefined,meetingUrl:event.meetingUrl,location:event.location,ownerId:userId,organizationId:targetOrg,relationshipId:rel?.id};
          if(meetingId){await this.prisma.meeting.update({where:{id:meetingId},data}); summary.updated++;}
          else {const m=await this.prisma.meeting.create({data}); meetingId=m.id; summary.created++;}
          if(personIds.length) {await this.prisma.meetingParticipant.deleteMany({where:{meetingId}});await this.prisma.meetingParticipant.createMany({data:personIds.map(personId=>({meetingId:meetingId!,personId})),skipDuplicates:true});}
          const payload=event.raw as any;
          await this.prisma.integrationExternalRecord.upsert({where:{connectionId_kind_externalId:{connectionId,kind:event.kind,externalId:event.externalId}},create:{connectionId,kind:event.kind,externalId:event.externalId,externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,meetingId,personId:personIds[0],organizationId:targetOrg,relationshipId:rel?.id,payload},update:{externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,status:'ACTIVE',meetingId,personId:personIds[0],organizationId:targetOrg,relationshipId:rel?.id,payload,cancelledAt:null}});
        } else if(event.kind==='EMAIL'){
          const subject=event.subject||event.title||'Imported email';
          const occurredAt=event.updatedAt?new Date(event.updatedAt):new Date();
          const existingInteraction=existing?.interactionId;
          const attachment={externalConnectionId:connectionId,externalMessageId:event.externalId,externalThreadId:event.threadId||null,providerPayload:event.raw};
          let interactionId=existingInteraction;
          if(interactionId){await this.prisma.interaction.update({where:{id:interactionId},data:{subject,occurredAt,summary:JSON.stringify({threadId:event.threadId,sender:event.sender,recipients:event.recipients}),organizationId:targetOrg,personId:personIds[0],relationshipId:rel?.id,attachments:attachment as any}});summary.updated++;}
          else {const i=await this.prisma.interaction.create({data:{type:'EMAIL',subject,summary:JSON.stringify({threadId:event.threadId,sender:event.sender,recipients:event.recipients}),occurredAt,userId,organizationId:targetOrg,personId:personIds[0],relationshipId:rel?.id,attachments:attachment as any}});interactionId=i.id;summary.created++;}
          await this.prisma.integrationExternalRecord.upsert({where:{connectionId_kind_externalId:{connectionId,kind:event.kind,externalId:event.externalId}},create:{connectionId,kind:event.kind,externalId:event.externalId,externalThreadId:event.threadId,externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,interactionId,personId:personIds[0],organizationId:targetOrg,relationshipId:rel?.id,payload:event.raw as any},update:{externalThreadId:event.threadId,externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,status:'ACTIVE',interactionId,personId:personIds[0],organizationId:targetOrg,relationshipId:rel?.id,payload:event.raw as any}});
        } else {
          await this.prisma.integrationExternalRecord.upsert({where:{connectionId_kind_externalId:{connectionId,kind:event.kind,externalId:event.externalId}},create:{connectionId,kind:event.kind,externalId:event.externalId,externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,status:event.cancelled?'CANCELLED':'ACTIVE',cancelledAt:event.cancelled?new Date():undefined,personId:personIds[0],organizationId:targetOrg,payload:event.raw as any},update:{externalUpdatedAt:event.updatedAt?new Date(event.updatedAt):undefined,etag:event.etag,status:event.cancelled?'CANCELLED':'ACTIVE',cancelledAt:event.cancelled?new Date():undefined,personId:personIds[0],organizationId:targetOrg,payload:event.raw as any}});
          if(existing)summary.updated++; else summary.created++;
        }
      }catch(e:any){summary.errors.push(`${event.kind}:${event.externalId}:${String(e?.message||e)}`);}
    }
    await this.prisma.integrationSyncRun.update({where:{id:runId},data:{completedAt:new Date(),status:summary.errors.length?'PARTIAL':'SUCCESS',seen:summary.seen,created:summary.created,updated:summary.updated,cancelled:summary.cancelled,matchedPeople:summary.matchedPeople,matchedOrganizations:summary.matchedOrganizations,linkedRelationships:summary.linkedRelationships,errors:summary.errors as any}});
    return summary;
  }
}
