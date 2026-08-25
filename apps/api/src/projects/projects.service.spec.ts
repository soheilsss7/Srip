import { ProjectsService } from './projects.service';

describe('ProjectsService Phase 9 contracts', () => {
  const prisma:any = { project:{findUnique:jest.fn(),create:jest.fn(),update:jest.fn()}, requirement:{create:jest.fn(),findUnique:jest.fn(),update:jest.fn()}, projectRelationship:{upsert:jest.fn(),delete:jest.fn()} };
  const authorization:any = { assertPermission:jest.fn(), assertAnyOrganizationAccess:jest.fn(), accessibleOrganizationIds:jest.fn() };
  const audit:any = { logMutation:jest.fn() };
  const service = new ProjectsService(prisma, authorization, audit);
  beforeEach(()=>jest.clearAllMocks());
  it('rejects missing project', async()=>{prisma.project.findUnique.mockResolvedValue(null); await expect(service.get('u','p')).rejects.toThrow('Project not found');});
  it('audits project creation', async()=>{authorization.assertPermission.mockResolvedValue(undefined); const row={id:'p1',organizationId:'o1'}; prisma.project.create.mockResolvedValue(row); await service.create('u',{name:'P',organizationId:'o1'}); expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({action:'CREATE',entityType:'Project',entityId:'p1'}));});
});
