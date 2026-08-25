import { AccessScopeType, DataClassification } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { AuthorizationService, classificationAllows, AuthorizationContext } from './authorization.service';
import { ROLES } from './access.constants';

describe('AuthorizationService contract', () => {
  it('uses the standardized AuthorizationContext shape', () => {
    const context: AuthorizationContext = {
      organizationId: 'org-1', ownerId: 'user-1', createdById: 'user-1',
      classification: DataClassification.CONFIDENTIAL,
      entityType: 'Relationship', entityId: 'rel-1',
      sensitivity: DataClassification.RESTRICTED, departmentId: 'dept-1', field: 'riskScore',
      relationshipOrganizationIds: ['org-1', 'org-2'],
    };
    expect(context.entityType).toBe('Relationship');
    expect(context.relationshipOrganizationIds).toEqual(['org-1', 'org-2']);
  });

  it('fails closed when a resource organization is outside the user scope', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', isActive: true, deletedAt: null }) },
      membership: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([{ id:'m1',userId:'u1',organizationId:'o1',role:ROLES.STANDARD_USER,department:null,departmentUnitId:null,dataScope:DataClassification.CONFIDENTIAL,accessScope:AccessScopeType.ORGANIZATION,scope:null,isPrimary:true }]) },
      organization: { findMany: jest.fn().mockResolvedValue([]) },
      relationship: { findUnique: jest.fn().mockResolvedValue({ sourceOrganizationId:'o1', targetOrganizationId:'o2' }) },
    };
    const service = new AuthorizationService(prisma);
    await expect(service.assertPermission('u1','relationship.read',{ organizationId:'o1', relationshipOrganizationIds:['o1','o2'], entityType:'Relationship', entityId:'r1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unknown permissions instead of bypassing the catalog', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ id:'u1',isActive:true,deletedAt:null }) } };
    const service = new AuthorizationService(prisma);
    await expect(service.assertPermission('u1','not.catalogued',{})).rejects.toThrow('Unknown permission');
  });
});

describe('classificationAllows', () => {
  it('allows values at or below policy maximum', () => {
    expect(classificationAllows('CONFIDENTIAL','PUBLIC')).toBe(true);
    expect(classificationAllows('CONFIDENTIAL','CONFIDENTIAL')).toBe(true);
  });
  it('denies values above policy maximum and fails closed on unknown requested values', () => {
    expect(classificationAllows('INTERNAL','CONFIDENTIAL')).toBe(false);
    expect(classificationAllows('PUBLIC','UNKNOWN')).toBe(false);
  });
});
