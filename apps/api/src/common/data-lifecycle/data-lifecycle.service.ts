import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataLifecycleState, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuditService } from '../../audit/audit.service';
import { LIFECYCLE_ENTITIES } from './data-lifecycle.types';
import { EntityResponseDto } from '../dto/entity-response.dto';
@Injectable()
export class DataLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}
  config(entityType:string){const c=LIFECYCLE_ENTITIES[entityType];if(!c)throw new BadRequestException(`Unsupported lifecycle entity: ${entityType}`);return c;}
  private delegate(entityType:string):any{return (this.prisma as any)[this.config(entityType).delegate];}
  private async load(entityType:string,id:string,includeDeleted=true){const row=await this.delegate(entityType).findUnique({where:{id}});if(!row||(!includeDeleted&&row.deletedAt))throw new NotFoundException(`${entityType} not found`);return row;}
  private async record(entityType:string,entityId:string,state:DataLifecycleState,actorId:string,reason?:string,approvalId?:string,metadata?:unknown){return (this.prisma as any).dataLifecycleRecord.create({data:{entityType,entityId,state,actorId,reason,approvalId,metadata:metadata as any}});}
  private async scope(userId:string,entityType:string,row:any,permission?:string){const c=this.config(entityType);const orgIds=c.organizationFields.map(f=>row[f]).filter(Boolean) as string[];if(orgIds.length){await this.authorization.assertAnyOrganizationAccess(userId,orgIds);for(const orgId of orgIds)await this.authorization.assertPermission(userId, permission??c.permission, { organizationId: orgId, entityType, entityId: row.id, ownerId: row.ownerId ?? undefined, createdById: row.createdById ?? undefined });}else await this.authorization.assertPermission(userId, permission??c.permission, {});return orgIds[0];}
  async softDelete(userId:string,entityType:string,id:string,reason='soft-delete',tx?: Prisma.TransactionClient){const row=await this.load(entityType,id,false);const organizationId=await this.scope(userId,entityType,row);const c=this.config(entityType);const data:any={deletedAt:new Date(),deletedById:userId};if(c.softDeleteStatus)data[c.softDeleteStatus.field]=c.softDeleteStatus.value;const db:any=tx ?? this.prisma; const delegate=(db as any)[this.config(entityType).delegate]; const updated=await delegate.update({where:{id},data}); await (db as any).dataLifecycleRecord.create({data:{entityType,entityId:id,state:DataLifecycleState.DELETION,actorId:userId,reason,metadata:{previousStatus:c.softDeleteStatus?row[c.softDeleteStatus.field]:undefined}}}); await this.audit.logMutation({userId,action:'SOFT_DELETE',entityType,entityId:id,organizationId,before:row,after:updated,reason},tx);return updated;}
  async softDeleteMany(userId:string,entityType:string,where:any,reason='retention-soft-delete'){const c=this.config(entityType);const organizationId=where.organizationId;if(reason.startsWith('retention-policy:')){if(organizationId)await this.authorization.assertPermission(userId, 'privacy.manage', { organizationId: organizationId });else await this.authorization.assertPermission(userId, 'privacy.manage', {});}else{if(organizationId)await this.authorization.assertPermission(userId, c.permission, { organizationId: organizationId });else await this.authorization.assertPermission(userId, c.permission, {});}const data:any={deletedAt:new Date(),deletedById:userId};if(c.softDeleteStatus)data[c.softDeleteStatus.field]=c.softDeleteStatus.value;const result=await this.delegate(entityType).updateMany({where:{...where,deletedAt:null},data});await this.audit.logMutation({userId,action:'SOFT_DELETE',entityType,organizationId,after:{count:result.count},reason});return result;}
  async restore(userId:string,entityType:string,id:string,reason='restore',tx?: Prisma.TransactionClient){const row=await this.load(entityType,id,true);if(!row.deletedAt)return row;const organizationId=await this.scope(userId,entityType,row);const c=this.config(entityType);const data:any={deletedAt:null,deletedById:null};if(c.restoreStatus)data[c.restoreStatus.field]=c.restoreStatus.value;const db:any=tx ?? this.prisma;const updated=await (db as any)[c.delegate].update({where:{id},data});await (db as any).dataLifecycleRecord.create({data:{entityType,entityId:id,state:DataLifecycleState.RESTORED,actorId:userId,reason}});await this.audit.logMutation({userId,action:'RESTORE',entityType,entityId:id,organizationId,before:row,after:updated,reason},tx);return EntityResponseDto.fromUnknown(updated);}
  async requestPermanentDelete(userId:string,entityType:string,id:string,reason?:string){
    const row=await this.load(entityType,id,true);
    if(!row.deletedAt)throw new ConflictException('Entity must be soft-deleted before permanent deletion');
    const organizationId=await this.scope(userId,entityType,row,'data.permanent_delete');
    const policy=await this.prisma.dataProcessingPolicy.findFirst({where:{entityType,active:true,erasable:false}});
    if(policy)throw new ForbiddenException('Data processing policy forbids erasure');
    const existing=await this.prisma.approvalRequest.findFirst({where:{entityType:'DataLifecycle',entityId:id,actionType:'DELETE',status:'PENDING'}});
    if(existing)return existing;
    const approval=await this.prisma.approvalRequest.create({data:{
      entityType:'DataLifecycle',entityId:id,actionType:'DELETE',organizationId,requestedById:userId,status:'PENDING',
      reason,before:row as any,after:{entityType} as any
    }});
    await this.record(entityType,id,DataLifecycleState.DELETION,userId,'permanent-delete-approval-requested',approval.id);
    await this.audit.logMutation({userId,action:'APPROVAL_REQUESTED',entityType:'ApprovalRequest',entityId:approval.id,organizationId,after:approval,reason});
    return approval;
  }

  async listPendingApprovals(userId:string){
    await this.authorization.assertPermission(userId,'approval.read',{});
    const ids=await this.authorization.accessibleOrganizationIds(userId);
    return EntityResponseDto.manyUnknown(await this.prisma.approvalRequest.findMany({where:{actionType:'DELETE',status:'PENDING',...(ids?{organizationId:{in:ids}}:{})},orderBy:{createdAt:'asc'}}));
  }
  async approvePermanentDelete(approverId:string,approvalId:string,reason='approved'){
    await this.authorization.assertPermission(approverId,'approval.decide',{});
    const approval=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});
    if(!approval||approval.status!=='PENDING'||approval.actionType!=='DELETE')throw new NotFoundException('Pending deletion approval not found');
    if(approval.requestedById===approverId)throw new ForbiddenException('Requester cannot approve their own permanent deletion');
    await this.authorization.assertPermission(approverId,'data.permanent_delete',{organizationId: approval.organizationId ?? undefined});
    const claim=await this.prisma.approvalRequest.updateMany({where:{id:approvalId,status:'PENDING'},data:{status:'APPROVED',decidedById:approverId,decidedAt:new Date()}});if(claim.count!==1)throw new ConflictException('Approval was already decided');const updated=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});if(!updated)throw new NotFoundException('Approval not found after claim');
    await this.audit.logMutation({userId:approverId,action:'APPROVAL_APPROVED',entityType:'ApprovalRequest',entityId:approvalId,organizationId:approval.organizationId??undefined,before:approval,after:updated,reason});
    return this.permanentDelete(approverId,String((approval.after as any)?.entityType),approval.entityId,approval.id,reason);
  }
  async rejectPermanentDelete(approverId:string,approvalId:string,reason='rejected'){
    await this.authorization.assertPermission(approverId,'approval.decide',{});
    const approval=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});
    if(!approval||approval.status!=='PENDING'||approval.actionType!=='DELETE')throw new NotFoundException('Pending deletion approval not found');
    await this.authorization.assertPermission(approverId,'data.permanent_delete',{organizationId: approval.organizationId ?? undefined});
    const claim=await this.prisma.approvalRequest.updateMany({where:{id:approvalId,status:'PENDING'},data:{status:'REJECTED',decidedById:approverId,decidedAt:new Date()}});if(claim.count!==1)throw new ConflictException('Approval was already decided');const updated=await this.prisma.approvalRequest.findUnique({where:{id:approvalId}});if(!updated)throw new NotFoundException('Approval not found after claim');
    await this.audit.logMutation({userId:approverId,action:'APPROVAL_REJECTED',entityType:'ApprovalRequest',entityId:approvalId,organizationId:approval.organizationId??undefined,before:approval,after:updated,reason});
    return EntityResponseDto.fromUnknown(updated);
  }

  async permanentDelete(userId:string,entityType:string,id:string,approvalId:string,reason='permanent-delete',tx?: Prisma.TransactionClient){if(!(await this.authorization.isSuperAdmin(userId)))throw new ForbiddenException('Only Super Admin can permanently delete data');await this.authorization.assertPermission(userId, 'data.permanent_delete', {});const row=await this.load(entityType,id,true);if(!row.deletedAt)throw new ConflictException('Entity must be soft-deleted before permanent deletion');const db:any=tx ?? this.prisma; const approval=await db.approvalRequest.findUnique({where:{id:approvalId}});if(!approval||approval.status!=='APPROVED'||approval.actionType!=='DELETE'||approval.decidedById!==userId||approval.entityType!=='DataLifecycle'||approval.entityId!==id)throw new ForbiddenException('Valid approved deletion request required');const organizationId=await this.scope(userId,entityType,row,'data.permanent_delete');const policy=await db.dataProcessingPolicy.findFirst({where:{entityType,active:true}});if(policy&&!policy.erasable)throw new ForbiddenException('Data processing policy forbids erasure');const delegate=(db as any)[this.config(entityType).delegate];await delegate.delete({where:{id}});await (db as any).dataLifecycleRecord.create({data:{entityType,entityId:id,state:DataLifecycleState.PURGED,actorId:userId,reason,approvalId,metadata:{purgedAt:new Date().toISOString()}}});await this.audit.logMutation({userId,action:'PERMANENT_DELETE',entityType,entityId:id,organizationId,before:row,reason},tx);return{deleted:true,entityType,entityId:id,approvalId};}
}
