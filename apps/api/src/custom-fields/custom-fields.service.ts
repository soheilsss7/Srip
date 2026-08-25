import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuditService } from '../audit/audit.service';
import { CUSTOM_FIELD_ENTITY_TYPES, CustomFieldEntityType, CustomFieldType, isCustomFieldEntityType, isCustomFieldType } from './custom-fields.types';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

const VALUE_KEYS = ['stringValue','numberValue','booleanValue','dateValue','jsonValue'] as const;
type ValueKey = typeof VALUE_KEYS[number];
type DefinitionInput = { key: string; label: string; entityType: string; fieldType: string; options?: unknown; required?: boolean; active?: boolean; organizationId?: string };
type ValueInput = { customFieldId: string; value: unknown };

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  private normalizeKey(key: string) {
    const normalized = String(key ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalized || normalized.length > 100) throw new BadRequestException('Custom field key must be between 1 and 100 characters');
    return normalized;
  }

  private assertType(type: string): asserts type is CustomFieldType {
    if (!isCustomFieldType(type)) throw new BadRequestException(`Unsupported custom field type: ${type}`);
  }

  private assertEntityType(entityType: string): asserts entityType is CustomFieldEntityType {
    if (!isCustomFieldEntityType(entityType)) throw new BadRequestException(`Unsupported custom field entity type: ${entityType}`);
  }

  private normalizeOptions(fieldType: CustomFieldType, options: unknown): Prisma.InputJsonValue | undefined {
    const needsOptions = fieldType === 'select' || fieldType === 'multiselect';
    if (!needsOptions && options !== undefined && options !== null) throw new BadRequestException('options are only valid for select/multiselect fields');
    if (!needsOptions) return undefined;
    if (!Array.isArray(options) || options.length === 0 || options.some(x => typeof x !== 'string' || !x.trim())) throw new BadRequestException('select/multiselect options must be a non-empty array of strings');
    const normalized = [...new Set(options.map(x => String(x).trim()))];
    if (normalized.length !== options.length) throw new BadRequestException('Custom field options must be unique');
    return normalized as Prisma.InputJsonValue;
  }

  async upsertDefinition(userId: string, data: DefinitionInput) {
    await this.authorization.assertPermission(userId, 'admin.custom_fields', { organizationId: data.organizationId });
    if (!data.label?.trim() || !data.entityType || !data.fieldType) throw new BadRequestException('Custom field key, label, entityType and fieldType are required');
    this.assertEntityType(data.entityType); this.assertType(data.fieldType);
    const key = this.normalizeKey(data.key);
    const options = this.normalizeOptions(data.fieldType, data.options);
    if (data.organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: data.organizationId }, select: { id: true, deletedAt: true } });
      if (!org || org.deletedAt) throw new NotFoundException('Organization not found');
    }
    const existing = await this.prisma.customField.findFirst({ where: { organizationId: data.organizationId ?? null, entityType: data.entityType, key } });
    if (existing && existing.fieldType !== data.fieldType) {
      const values = await this.prisma.customFieldValue.count({ where: { customFieldId: existing.id } });
      if (values) throw new ConflictException('Cannot change custom field type after values exist');
    }
    const before = existing;
    const row = existing
      ? await this.prisma.customField.update({ where: { id: existing.id }, data: { label: data.label.trim(), fieldType: data.fieldType, options, required: !!data.required, active: data.active ?? true } })
      : await this.prisma.customField.create({ data: { key, label: data.label.trim(), entityType: data.entityType, fieldType: data.fieldType, options, required: !!data.required, active: data.active ?? true, organizationId: data.organizationId, createdById: userId } });
    await this.audit.logMutation({ userId, action: existing ? AuditAction.CUSTOM_FIELD_UPDATED : AuditAction.CUSTOM_FIELD_CREATED, entityType: 'CustomField', entityId: row.id, organizationId: row.organizationId ?? undefined, before, after: row, reason: existing ? 'Custom field definition updated' : 'Custom field definition created' });
    return EntityResponseDto.fromUnknown(row);
  }

  async listDefinitions(userId: string, entityType?: string, organizationId?: string) {
    await this.authorization.assertPermission(userId, 'admin.custom_fields', { organizationId: organizationId });
    if (entityType) this.assertEntityType(entityType);
    return EntityResponseDto.manyUnknown(await this.prisma.customField.findMany({ where: { ...(entityType ? { entityType } : {}), ...(organizationId !== undefined ? { organizationId } : {}) }, orderBy: [{ entityType: 'asc' }, { key: 'asc' }] }));
  }

  async deleteDefinition(userId: string, id: string) {
    const before = await this.prisma.customField.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Custom field not found');
    await this.authorization.assertPermission(userId, 'admin.custom_fields', { organizationId: before.organizationId ?? undefined });
    const values = await this.prisma.customFieldValue.count({ where: { customFieldId: id } });
    if (values) throw new ConflictException('Cannot delete a custom field that has values; deactivate it instead');
    await this.prisma.customField.delete({ where: { id } });
    await this.audit.logMutation({ userId, action: AuditAction.CUSTOM_FIELD_DELETED, entityType: 'CustomField', entityId: id, organizationId: before.organizationId ?? undefined, before, reason: 'Custom field definition deleted' });
    return { deleted: true, id };
  }

  private async entityOrganizationIds(entityType: CustomFieldEntityType, entityId: string): Promise<string[]> {
    const deleted = { deletedAt: null as any };
    switch (entityType) {
      case 'Organization': { const r=await this.prisma.organization.findFirst({where:{id:entityId,...deleted},select:{id:true}}); if(!r) throw new NotFoundException('Entity not found'); return [r.id]; }
      case 'Person': { const r=await this.prisma.person.findFirst({where:{id:entityId,...deleted},select:{organizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId]; }
      case 'Relationship': { const r=await this.prisma.relationship.findFirst({where:{id:entityId,...deleted},select:{sourceOrganizationId:true,targetOrganizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return [r.sourceOrganizationId,r.targetOrganizationId]; }
      case 'Interaction': { const r=await this.prisma.interaction.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId].filter(Boolean) as string[]; }
      case 'Meeting': { const r=await this.prisma.meeting.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId].filter(Boolean) as string[]; }
      case 'Action': { const r=await this.prisma.action.findFirst({where:{id:entityId,...deleted},select:{person:{select:{organizationId:true}},project:{select:{organizationId:true}},relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}},meeting:{select:{organizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.person?.organizationId,r.project?.organizationId,r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId,r.meeting?.organizationId].filter(Boolean) as string[]; }
      case 'Commitment': { const r=await this.prisma.commitment.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,person:{select:{organizationId:true}},project:{select:{organizationId:true}},relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}},meeting:{select:{organizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.person?.organizationId,r.project?.organizationId,r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId,r.meeting?.organizationId].filter(Boolean) as string[]; }
      case 'Project': { const r=await this.prisma.project.findFirst({where:{id:entityId,...deleted},select:{organizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return r.organizationId?[r.organizationId]:[]; }
      case 'Requirement': { const r=await this.prisma.projectRequirement.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,project:{select:{organizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.project.organizationId].filter(Boolean) as string[]; }
      case 'Opportunity': { const r=await this.prisma.opportunity.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,project:{select:{organizationId:true}},relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.project?.organizationId,r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId].filter(Boolean) as string[]; }
      case 'Recommendation': { const r=await this.prisma.recommendation.findFirst({where:{id:entityId,...deleted},select:{relationship:{select:{sourceOrganizationId:true,targetOrganizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.relationship?.sourceOrganizationId,r.relationship?.targetOrganizationId].filter(Boolean) as string[]; }
      case 'Document': { const r=await this.prisma.document.findFirst({where:{id:entityId,...deleted},select:{organizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return r.organizationId?[r.organizationId]:[]; }
      case 'Note': { const r=await this.prisma.note.findFirst({where:{id:entityId,...deleted},select:{organizationId:true,person:{select:{organizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId,r.person?.organizationId].filter(Boolean) as string[]; }
      case 'Workflow': { const r=await this.prisma.workflow.findFirst({where:{id:entityId,...deleted},select:{organizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return r.organizationId?[r.organizationId]:[]; }
      case 'Referral': { const r=await this.prisma.referral.findFirst({where:{id:entityId,...deleted},select:{sourceOrganizationId:true,targetOrganizationId:true,sourcePerson:{select:{organizationId:true}},targetPerson:{select:{organizationId:true}}}}); if(!r) throw new NotFoundException('Entity not found'); return [r.sourceOrganizationId,r.targetOrganizationId,r.sourcePerson?.organizationId,r.targetPerson?.organizationId].filter(Boolean) as string[]; }
      case 'ConnectionPath': { const r=await this.prisma.connectionPath.findFirst({where:{id:entityId},select:{sourceOrganizationId:true,targetOrganizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return [r.sourceOrganizationId,r.targetOrganizationId]; }
      case 'OrganizationUnit': { const r=await this.prisma.organizationUnit.findFirst({where:{id:entityId},select:{organizationId:true}}); if(!r) throw new NotFoundException('Entity not found'); return [r.organizationId]; }
    }
  }

  private async assertEntityAccess(userId: string, entityType: CustomFieldEntityType, entityId: string, write: boolean) {
    const orgIds = [...new Set(await this.entityOrganizationIds(entityType, entityId))];
    if (!orgIds.length) { if (!(await this.authorization.isSuperAdmin(userId))) throw new ForbiddenException('Entity has no organization scope'); return undefined; }
    const accessible = await this.authorization.accessibleOrganizationIds(userId);
    if (accessible !== null && !orgIds.some(id => accessible.includes(id))) throw new ForbiddenException('Organization scope denied');
    for (const id of orgIds) await this.authorization.assertPermission(userId, write ? 'entity.write' : 'entity.read', { organizationId: id });
    return orgIds[0];
  }

  private toStoredValue(fieldType: CustomFieldType, value: unknown): { key: ValueKey; value: string|number|boolean|Date|Prisma.InputJsonValue } {
    if (value === null || value === undefined) throw new BadRequestException('Custom field value cannot be null; omit it to remove the value');
    if (fieldType === 'text' || fieldType === 'email' || fieldType === 'url') {
      if (typeof value !== 'string') throw new BadRequestException('Expected string custom field value');
      const v=value.trim(); if (!v) throw new BadRequestException('String custom field value cannot be empty');
      if (fieldType==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new BadRequestException('Invalid email custom field value');
      if (fieldType==='url') { try { new URL(v); } catch { throw new BadRequestException('Invalid URL custom field value'); } }
      return {key:'stringValue',value:v};
    }
    if (fieldType === 'number') { const n=typeof value==='number'?value:Number(value); if(!Number.isFinite(n)) throw new BadRequestException('Invalid number custom field value'); return {key:'numberValue',value:n}; }
    if (fieldType === 'boolean') { if(typeof value!=='boolean') throw new BadRequestException('Expected boolean custom field value'); return {key:'booleanValue',value}; }
    if (fieldType === 'date' || fieldType === 'datetime') { const d=new Date(String(value)); if(Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date custom field value'); return {key:'dateValue',value:d}; }
    if (fieldType === 'select') { if(typeof value!=='string') throw new BadRequestException('Expected string select value'); return {key:'jsonValue',value:value as Prisma.InputJsonValue}; }
    if (fieldType === 'multiselect') { if(!Array.isArray(value) || value.some(v=>typeof v!=='string')) throw new BadRequestException('Expected string array for multiselect'); return {key:'jsonValue',value:value as Prisma.InputJsonValue}; }
    throw new BadRequestException('Unsupported custom field type');
  }

  private validateOption(fieldType: CustomFieldType, options: unknown, stored: any) {
    if (fieldType !== 'select' && fieldType !== 'multiselect') return;
    if (!Array.isArray(options)) throw new BadRequestException('Select field options are missing');
    if (fieldType === 'select' && (typeof stored !== 'string' || !options.includes(stored))) throw new BadRequestException('Value is not one of the configured options');
    if (fieldType === 'multiselect' && (!Array.isArray(stored) || stored.some((x:string)=>!options.includes(x)))) throw new BadRequestException('One or more values are not configured options');
  }

  private buildValueData(fieldType: CustomFieldType, value: unknown) {
    const stored=this.toStoredValue(fieldType,value);
    return { ...Object.fromEntries(VALUE_KEYS.map(k=>[k,null])), [stored.key]: stored.value } as Prisma.CustomFieldValueCreateInput;
  }

  async getEntityValues(userId: string, entityType: string, entityId: string) {
    this.assertEntityType(entityType); const organizationId=await this.assertEntityAccess(userId,entityType,entityId,false);
    const defs=await this.prisma.customField.findMany({where:{entityType,active:true,OR:[{organizationId:null},{organizationId}]},orderBy:{key:'asc'}});
    const values=await this.prisma.customFieldValue.findMany({where:{entityType,entityId,customFieldId:{in:defs.map(d=>d.id)}}});
    const byId=new Map(values.map(v=>[v.customFieldId,v]));
    return defs.map(d=>({ ...d, value: this.readStoredValue(d.fieldType,byId.get(d.id)) }));
  }

  private readStoredValue(fieldType: string, row: any) {
    if (!row) return null;
    if (fieldType==='text'||fieldType==='email'||fieldType==='url') return row.stringValue;
    if (fieldType==='number') return row.numberValue;
    if (fieldType==='boolean') return row.booleanValue;
    if (fieldType==='date'||fieldType==='datetime') return row.dateValue;
    return row.jsonValue;
  }

  async setEntityValues(userId: string, entityType: string, entityId: string, inputs: ValueInput[]) {
    this.assertEntityType(entityType); const organizationId=await this.assertEntityAccess(userId,entityType,entityId,true);
    if (!Array.isArray(inputs) || inputs.length===0) throw new BadRequestException('values must be a non-empty array');
    const ids=[...new Set(inputs.map(x=>x.customFieldId))]; if(ids.length!==inputs.length) throw new ConflictException('Duplicate customFieldId in request');
    const defs=await this.prisma.customField.findMany({where:{id:{in:ids},entityType,active:true,OR:[{organizationId:null},{organizationId}]}});
    if(defs.length!==ids.length) throw new BadRequestException('One or more custom fields are unavailable for this entity');
    const defMap=new Map(defs.map(d=>[d.id,d]));
    const prepared=inputs.map(input=>{const d=defMap.get(input.customFieldId)!; const stored=this.toStoredValue(d.fieldType as CustomFieldType,input.value); this.validateOption(d.fieldType as CustomFieldType,d.options,stored.value); return {d,input,stored};});
    const current=await this.prisma.customFieldValue.findMany({where:{entityType,entityId,customFieldId:{in:ids}}});
    const currentMap=new Map(current.map(v=>[v.customFieldId,v]));
    await this.prisma.$transaction(async tx=>{
      for(const {d,input,stored} of prepared){
        const data=this.buildValueData(d.fieldType as CustomFieldType,input.value);
        await tx.customFieldValue.upsert({where:{customFieldId_entityType_entityId:{customFieldId:d.id,entityType,entityId}},create:{customFieldId:d.id,entityType,entityId,...data},update:data});
      }
      const allRequired=await tx.customField.findMany({where:{entityType,active:true,required:true,OR:[{organizationId:null},{organizationId}]},select:{id:true}});
      const after=await tx.customFieldValue.findMany({where:{entityType,entityId,customFieldId:{in:allRequired.map(x=>x.id)}}});
      if(after.length!==allRequired.length) throw new BadRequestException('Required custom fields are missing');
    });
    for(const {d,input,stored} of prepared) await this.audit.logMutation({userId,action:AuditAction.CUSTOM_FIELD_VALUE_SET,entityType:'CustomFieldValue',entityId:`${d.id}:${entityType}:${entityId}`,organizationId,before:currentMap.get(d.id),after:{customFieldId:d.id,entityType,entityId,value:stored.value},reason:`Custom field value set: ${d.key}`});
    return this.getEntityValues(userId,entityType,entityId);
  }

  async removeEntityValue(userId: string, entityType: string, entityId: string, customFieldId: string) {
    this.assertEntityType(entityType); const organizationId=await this.assertEntityAccess(userId,entityType,entityId,true);
    const def=await this.prisma.customField.findFirst({where:{id:customFieldId,entityType,active:true,OR:[{organizationId:null},{organizationId}]}}); if(!def) throw new NotFoundException('Custom field not found');
    if(def.required) throw new ConflictException('Required custom field cannot be removed');
    const row=await this.prisma.customFieldValue.findUnique({where:{customFieldId_entityType_entityId:{customFieldId,entityType,entityId}}}); if(!row) throw new NotFoundException('Custom field value not found');
    await this.prisma.customFieldValue.delete({where:{id:row.id}});
    await this.audit.logMutation({userId,action:AuditAction.CUSTOM_FIELD_VALUE_REMOVED,entityType:'CustomFieldValue',entityId:row.id,organizationId,before:row,reason:`Custom field value removed: ${def.key}`});
    return {deleted:true,id:row.id};
  }
}
