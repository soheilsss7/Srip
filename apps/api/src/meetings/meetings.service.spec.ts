import { MeetingsService } from './meetings.service';

describe('MeetingsService contract', () => {
  it('exposes meeting lifecycle operations', () => {
    expect(typeof MeetingsService.prototype.list).toBe('function');
    expect(typeof MeetingsService.prototype.get).toBe('function');
    expect(typeof MeetingsService.prototype.create).toBe('function');
    expect(typeof MeetingsService.prototype.update).toBe('function');
    expect(typeof MeetingsService.prototype.complete).toBe('function');
    expect(typeof MeetingsService.prototype.replaceParticipants).toBe('function');
    expect(typeof MeetingsService.prototype.remove).toBe('function');
  });
  it('exposes Phase 26 minutes/follow-up operations', () => {
    expect(typeof MeetingsService.prototype.minutes).toBe('function');
    expect(typeof MeetingsService.prototype.extractActionItems).toBe('function');
    expect(typeof MeetingsService.prototype.extractActionItemsForMeeting).toBe('function');
    expect(typeof MeetingsService.prototype.applyActionItems).toBe('function');
    expect(typeof MeetingsService.prototype.finalize).toBe('function');
    expect(typeof MeetingsService.prototype.followUps).toBe('function');
    expect(typeof MeetingsService.prototype.regenerateFollowUpCandidates).toBe('function');
  });
});

describe('MeetingsService.extractActionItems (deterministic, no AI/network dependency)', () => {
  const prisma: any = {};
  const authorization: any = {};
  const audit: any = {};
  const service = new MeetingsService(prisma, authorization, audit);

  it('returns an empty array for empty/whitespace input', () => {
    expect(service.extractActionItems('')).toEqual([]);
    expect(service.extractActionItems('   ')).toEqual([]);
  });

  it('extracts a Persian action-oriented sentence', () => {
    const out = service.extractActionItems('باید تا هفته آینده قرارداد را ارسال کنیم.');
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].text).toContain('قرارداد');
    expect(out[0].isCommitmentLike).toBe(false);
  });

  it('flags commitment-like language separately from generic action language', () => {
    const out = service.extractActionItems('ما متعهد شدیم که ظرف ۱۰ روز شرایط تأمین مالی را ارسال کنیم.');
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].isCommitmentLike).toBe(true);
  });

  it('honors an explicit day count for the suggested due date', () => {
    const out = service.extractActionItems('لطفا ظرف 10 روز گزارش را آماده کنید.');
    expect(out.length).toBeGreaterThan(0);
    const due = new Date(out[0].suggestedDueAt);
    const now = new Date();
    const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
    expect(diffDays).toBeGreaterThanOrEqual(9);
    expect(diffDays).toBeLessThanOrEqual(11);
  });

  it('ignores sentences with no action/commitment signal', () => {
    const out = service.extractActionItems('جلسه در فضای خوبی برگزار شد و همه راضی بودند.');
    expect(out).toEqual([]);
  });

  it('deduplicates identical sentences', () => {
    const out = service.extractActionItems('باید ایمیل را ارسال کنیم. باید ایمیل را ارسال کنیم.');
    expect(out.length).toBe(1);
  });
});

describe('MeetingsService.minutes (structured output)', () => {
  it('summarizes open/overdue/completed action items and commitments from a meeting record', async () => {
    const past = new Date(Date.now() - 86400000);
    const future = new Date(Date.now() + 86400000);
    const meetingRow = {
      id: 'm1', title: 'Kickoff', objective: 'Align scope', startAt: new Date(), endAt: null,
      location: null, meetingUrl: null, agenda: 'Scope, budget', preMeetingBrief: null,
      notes: 'Notes here', decisions: [{ text: 'Proceed with vendor A' }], outcome: 'Positive',
      transcript: null, organizationId: 'org1', relationshipId: null, deletedAt: null, ownerId: 'u1',
      participants: [{ personId: 'p1', person: { displayName: 'Ali' } }],
      actions: [
        { id: 'a1', status: 'OPEN', dueAt: future },
        { id: 'a2', status: 'OPEN', dueAt: past },
        { id: 'a3', status: 'DONE', dueAt: past },
      ],
      commitments: [
        { id: 'c1', status: 'OPEN', dueAt: future },
        { id: 'c2', status: 'OVERDUE', dueAt: past },
        { id: 'c3', status: 'FULFILLED', dueAt: past },
      ],
    };
    const prisma: any = { meeting: { findUnique: jest.fn().mockResolvedValue(meetingRow) } };
    const authorization: any = { assertPermission: jest.fn(), assertAnyOrganizationAccess: jest.fn(), accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const audit: any = { logMutation: jest.fn() };
    const service = new MeetingsService(prisma, authorization, audit);
    const minutes = await service.minutes('u1', 'm1');
    expect(minutes.actionItems.overdueOpen).toHaveLength(1);
    expect(minutes.actionItems.open).toHaveLength(2);
    expect(minutes.actionItems.completed).toHaveLength(1);
    expect(minutes.commitments.overdue).toHaveLength(1);
    expect(minutes.commitments.open).toHaveLength(1);
    expect(minutes.commitments.fulfilled).toHaveLength(1);
    expect(minutes.isFinalized).toBe(true);
  });
});

describe('MeetingsService.applyActionItems', () => {
  it('creates an Action for a plain item and a Commitment for asCommitment=true, both linked to the meeting', async () => {
    const meetingRow = { id: 'm1', ownerId: 'u1', organizationId: 'org1', relationshipId: null, deletedAt: null, participants: [], actions: [], commitments: [] };
    const prisma: any = {
      meeting: { findUnique: jest.fn().mockResolvedValue(meetingRow) },
      action: { create: jest.fn().mockResolvedValue({ id: 'new-action' }) },
      commitment: { create: jest.fn().mockResolvedValue({ id: 'new-commitment' }) },
    };
    const authorization: any = { assertPermission: jest.fn(), assertAnyOrganizationAccess: jest.fn(), accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const audit: any = { logMutation: jest.fn() };
    const service = new MeetingsService(prisma, authorization, audit);
    const result = await service.applyActionItems('u1', 'm1', [
      { title: 'Send proposal', dueAt: new Date().toISOString() },
      { title: 'Deliver financing terms', asCommitment: true, description: 'Bank commitment' },
    ]);
    expect(result.created).toHaveLength(2);
    expect(result.created[0].type).toBe('Action');
    expect(result.created[1].type).toBe('Commitment');
    expect(prisma.action.create).toHaveBeenCalledTimes(1);
    expect(prisma.commitment.create).toHaveBeenCalledTimes(1);
    expect(audit.logMutation).toHaveBeenCalledTimes(2);
  });

  it('ignores candidates without a non-empty title', async () => {
    const meetingRow = { id: 'm1', ownerId: 'u1', organizationId: 'org1', relationshipId: null, deletedAt: null, participants: [], actions: [], commitments: [] };
    const prisma: any = { meeting: { findUnique: jest.fn().mockResolvedValue(meetingRow) }, action: { create: jest.fn() }, commitment: { create: jest.fn() } };
    const authorization: any = { assertPermission: jest.fn(), assertAnyOrganizationAccess: jest.fn(), accessibleOrganizationIds: jest.fn().mockResolvedValue(null) };
    const audit: any = { logMutation: jest.fn() };
    const service = new MeetingsService(prisma, authorization, audit);
    const result = await service.applyActionItems('u1', 'm1', [{ title: '   ' }]);
    expect(result.created).toHaveLength(0);
    expect(prisma.action.create).not.toHaveBeenCalled();
  });
});
