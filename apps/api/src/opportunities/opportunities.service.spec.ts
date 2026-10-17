import { OpportunitiesService } from './opportunities.service';

describe('OpportunitiesService Phase 9 contracts', () => {
 const prisma:any={opportunity:{findUnique:jest.fn(),create:jest.fn(),update:jest.fn()},project:{findUniqueOrThrow:jest.fn() },relationship:{findUniqueOrThrow:jest.fn()}};
 const authorization:any={assertPermission:jest.fn(),assertAnyOrganizationAccess:jest.fn(),accessibleOrganizationIds:jest.fn()}; const audit:any={logMutation:jest.fn()};
 const eventBus:any={transaction:jest.fn(async(cb:any)=>cb(prisma)),publishInTransaction:jest.fn()}; const lifecycle:any={softDelete:jest.fn()};
 const service=new OpportunitiesService(prisma,authorization,audit,eventBus,lifecycle);
 beforeEach(()=>jest.clearAllMocks());
 it('authorizes changed organization context on update',async()=>{const row={id:'x',organizationId:'o1',project:null,relationship:null,deletedAt:null};prisma.opportunity.findUnique.mockResolvedValue(row);authorization.assertAnyOrganizationAccess.mockResolvedValue(undefined);prisma.opportunity.update.mockResolvedValue({...row,organizationId:'o2'});await service.update('u','x',{organizationId:'o2'});expect(authorization.assertAnyOrganizationAccess).toHaveBeenCalledWith('u',['o2']);});
 it('audits create',async()=>{authorization.assertAnyOrganizationAccess.mockResolvedValue(undefined);const row={id:'x',organizationId:'o1'};prisma.opportunity.create.mockResolvedValue(row);await service.create('u',{name:'O',organizationId:'o1'});expect(audit.logMutation).toHaveBeenCalledWith(expect.objectContaining({entityType:'Opportunity',action:'CREATE'}),expect.anything());});
});
