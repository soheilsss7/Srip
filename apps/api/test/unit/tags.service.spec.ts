import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { TagsService } from '../../src/tags/tags.service';

describe('TagsService - Phase C', () => {
  const prisma: any = {
    tag: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    tagAssignment: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    organization: { findFirst: jest.fn() }, person: { findFirst: jest.fn() }, relationship: { findFirst: jest.fn() },
    interaction: { findFirst: jest.fn() }, meeting: { findFirst: jest.fn() }, action: { findFirst: jest.fn() },
    commitment: { findFirst: jest.fn() }, project: { findFirst: jest.fn() }, projectRequirement: { findFirst: jest.fn() },
    opportunity: { findFirst: jest.fn() }, recommendation: { findFirst: jest.fn() }, document: { findFirst: jest.fn() },
    note: { findFirst: jest.fn() }, workflow: { findFirst: jest.fn() }, referral: { findFirst: jest.fn() },
    connectionPath: { findFirst: jest.fn() }, organizationUnit: { findFirst: jest.fn() },
  };
  const authorization: any = {
    assertPermission: jest.fn().mockResolvedValue(undefined),
    accessibleOrganizationIds: jest.fn().mockResolvedValue(null),
    isSuperAdmin: jest.fn().mockResolvedValue(true),
  };
  const audit: any = { logMutation: jest.fn().mockResolvedValue(undefined) };
  let service: TagsService;

  beforeEach(() => { jest.clearAllMocks(); service = new TagsService(prisma, authorization, audit); });

  it('creates a tag and writes TagCreated audit', async () => {
    prisma.tag.findUnique.mockResolvedValue(null);
    const tag = { id: 't1', name: 'Strategic' };
    prisma.tag.create.mockResolvedValue(tag);
    await expect(service.create('u1', { name: ' Strategic ' })).resolves.toEqual(tag);
    expect(authorization.assertPermission).toHaveBeenCalledWith('u1', 'tag.write', {});
    expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.TAG_CREATED, entityType: 'Tag', entityId: 't1' }));
  });

  it('rejects duplicate tag names', async () => {
    prisma.tag.findUnique.mockResolvedValue({ id: 't1', name: 'Strategic' });
    await expect(service.create('u1', { name: 'Strategic' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires entity write scope before assignment', async () => {
    authorization.accessibleOrganizationIds.mockResolvedValue(['org-1']);
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', name: 'VIP' });
    prisma.tagAssignment.findUnique.mockResolvedValue(null);
    prisma.tagAssignment.create.mockResolvedValue({ id: 'a1', tag: { id: 'tag-1', name: 'VIP' }, organizationId: 'org-1' });
    await service.assign('u1', 'Organization', 'org-1', { tagId: 'tag-1' });
    expect(authorization.assertPermission).toHaveBeenCalledWith('u1', 'entity.write', { organizationId: 'org-1' });
    expect(authorization.assertPermission).toHaveBeenCalledWith('u1', 'tag.write', { organizationId: 'org-1' });
    expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.TAG_ASSIGNED, entityType: 'TagAssignment' }));
  });

  it('rejects an unsupported entity type', async () => {
    await expect(service.getEntityTags('u1', 'User', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inaccessible organization scope', async () => {
    authorization.accessibleOrganizationIds.mockResolvedValue(['org-2']);
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    await expect(service.getEntityTags('u1', 'Organization', 'org-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate assignments', async () => {
    authorization.accessibleOrganizationIds.mockResolvedValue(null);
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.tag.findUnique.mockResolvedValue({ id: 'tag-1', name: 'VIP' });
    prisma.tagAssignment.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.assign('u1', 'Organization', 'org-1', { tagId: 'tag-1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('writes TagRemoved audit on unassignment', async () => {
    authorization.accessibleOrganizationIds.mockResolvedValue(null);
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.tagAssignment.findUnique.mockResolvedValue({ id: 'a1', tagId: 'tag-1', entityType: 'Organization', entityId: 'org-1', organizationId: 'org-1', tag: { name: 'VIP' } });
    prisma.tagAssignment.delete.mockResolvedValue({ id: 'a1' });
    await service.removeAssignment('u1', 'Organization', 'org-1', 'tag-1');
    expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.TAG_REMOVED }));
  });
});
