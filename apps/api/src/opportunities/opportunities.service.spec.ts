import { OpportunitiesService } from './opportunities.service';

describe('OpportunitiesService Phase 9 contracts', () => {
 const prisma:any={opportunity:{findUnique:jest.fn(),create:jest.fn(),update:jest.fn()},project:{findUniqueOrThrow:jest.fn() },relationship:{findUniqueOrThrow:jest.fn()}};
 const authorization:any={assertPermission:jest.fn(),assertAnyOrganizationAccess:jest.fn(),accessibleOrganizationIds:jest.fn()}; const audit:any={logMutation:jest.fn()};
 const service=new OpportunitiesService(prisma,authorization,audit,{} as any,{} as any);
 beforeEach(()=>jest.clearAllMocks());
 it('authorizes changed organization context on update',async()=>{const row={id:'x',organizationId:'o1',project:null,relationship:null,deletedAt:null};prisma.opportunity.findUnique.mockResolvedValue(row);authorization.assertPermission.mockResolvedValue(undefined);prisma.opportunity.update.mockResolvedValue({...row,organizationId:'o2'});await service.update('u','x',{organizationId:'o2'});expect(authorization.assertPermission).toHaveBeenCalledWith('u','opportunity.write','o2');});
 it('audits create',async()=>{authorization.assertPermission.mockResolvedValue(undefined);const row={id:'x',organizationId:'o1'};prisma.opportunity.create.mockResolvedValue(row);await service.create('u',{name:'O',organizationId:'o1'});expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({entityType:'Opportunity',action:'CREATE'}));});
});
