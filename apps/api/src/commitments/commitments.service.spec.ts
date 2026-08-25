import { CommitmentsService } from './commitments.service';

describe('CommitmentsService Phase 9 contracts', () => {
  const prisma: any = { commitment: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() } };
  const authorization: any = { assertPermission: jest.fn(), assertAnyOrganizationAccess: jest.fn(), accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
  const audit: any = { logMutation: jest.fn() };
  const notifications: any = { create: jest.fn() };
  const service = new CommitmentsService(prisma, authorization, audit, notifications);

  it('marks overdue commitments deterministically', async () => {
    const row = { id: 'c', status: 'OPEN', dueAt: new Date(Date.now() - 1000), ownerId: 'u', relationship: null, meeting: null, project: null, person: null };
    prisma.commitment.findUnique.mockResolvedValue(row);
    prisma.commitment.update.mockResolvedValue({ ...row, status: 'OVERDUE' });
    const out = await service.markOverdue('u', 'c');
    expect(out.status).toBe('OVERDUE');
    expect(audit.logMutation).toHaveBeenCalled();
  });
});

describe('CommitmentsService.sweepOverdue (Phase 26 automatic follow-up)', () => {
  it('transitions every past-due OPEN commitment to OVERDUE and notifies its owner', async () => {
    const due = [
      { id: 'c1', ownerId: 'u1', description: 'Send financing terms', organizationId: 'org1' },
      { id: 'c2', ownerId: 'u2', description: 'Provide legal review', organizationId: 'org1' },
    ];
    const prisma: any = {
      commitment: {
        findMany: jest.fn().mockResolvedValue(due),
        update: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id, status: 'OVERDUE' })),
      },
    };
    const authorization: any = {};
    const audit: any = { logMutation: jest.fn() };
    const notifications: any = { create: jest.fn().mockResolvedValue({}) };
    const service = new CommitmentsService(prisma, authorization, audit, notifications);
    const result = await service.sweepOverdue();
    expect(result.swept).toBe(2);
    expect(result.commitmentIds).toEqual(['c1', 'c2']);
    expect(prisma.commitment.update).toHaveBeenCalledTimes(2);
    expect(audit.logMutation).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'ALERT', channel: 'IN_APP' }));
  });

  it('does not fail the sweep if a single notification delivery throws', async () => {
    const due = [{ id: 'c1', ownerId: 'u1', description: 'Send financing terms', organizationId: 'org1' }];
    const prisma: any = { commitment: { findMany: jest.fn().mockResolvedValue(due), update: jest.fn().mockResolvedValue({ id: 'c1', status: 'OVERDUE' }) } };
    const authorization: any = {};
    const audit: any = { logMutation: jest.fn() };
    const notifications: any = { create: jest.fn().mockRejectedValue(new Error('email disabled')) };
    const service = new CommitmentsService(prisma, authorization, audit, notifications);
    const result = await service.sweepOverdue();
    expect(result.swept).toBe(1);
  });

  it('returns zero when nothing is overdue', async () => {
    const prisma: any = { commitment: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CommitmentsService(prisma, {}, { logMutation: jest.fn() } as any, { create: jest.fn() } as any);
    const result = await service.sweepOverdue();
    expect(result.swept).toBe(0);
    expect(result.commitmentIds).toEqual([]);
  });
});

describe('CommitmentsService.listOverdue / listDueSoon (Phase 26 follow-up views)', () => {
  it('scopes listOverdue to OVERDUE status only', async () => {
    const prisma: any = { commitment: { findMany: jest.fn().mockResolvedValue([]) } };
    const authorization: any = { accessibleOrganizationIds: jest.fn().mockResolvedValue(['org1']) };
    const service = new CommitmentsService(prisma, authorization, {} as any, {} as any);
    await service.listOverdue('u1');
    const args = prisma.commitment.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('OVERDUE');
  });

  it('scopes listDueSoon to OPEN status within the given horizon', async () => {
    const prisma: any = { commitment: { findMany: jest.fn().mockResolvedValue([]) } };
    const authorization: any = { accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const service = new CommitmentsService(prisma, authorization, {} as any, {} as any);
    await service.listDueSoon('u1', 3);
    const args = prisma.commitment.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('OPEN');
    expect(args.where.dueAt.lte).toBeInstanceOf(Date);
  });
});
