import { JobWorker } from '../../src/jobs/job.worker';

/**
 * Phase 26: پیش از این تغییر، سه handler (meetingTranscribe, searchReindex,
 * analyticsRecompute) صراحتاً throw می‌کردند ("not configured"). این تست‌ها
 * تضمین می‌کنند این سه مسیر واقعاً به سرویس مربوطه delegate می‌شوند، نه اینکه
 * دوباره throw کنند.
 */
describe('JobWorker.process routing (Phase 26 regression: no throwing placeholders)', () => {
  const config: any = { get: jest.fn((_key: string, def?: any) => def) };
  const notifications: any = { create: jest.fn() };
  const ai: any = { indexDocument: jest.fn() };
  const documents: any = { index: jest.fn() };
  const integrations: any = { sync: jest.fn() };
  const recommendations: any = { generate: jest.fn() };
  const meetings: any = { regenerateFollowUpCandidates: jest.fn().mockResolvedValue({ meetingId: 'm1', candidateCount: 2 }) };
  const search: any = { reindex: jest.fn().mockResolvedValue({ analyzedTables: ['Organization'], errors: [] }) };
  const analytics: any = { recompute: jest.fn().mockResolvedValue({ organizationsProcessed: 1 }) };
  const commitments: any = { sweepOverdue: jest.fn().mockResolvedValue({ swept: 0, commitmentIds: [] }) };
  const queues: any = { enqueue: jest.fn(), deadLetter: jest.fn(), counts: jest.fn().mockResolvedValue({}) };
  const trace: any = {
    parseTraceparent: jest.fn((value?: string) => value ? { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceparent: value } : undefined),
    startRoot: jest.fn(() => ({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceparent: `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`, requestId: 'req', correlationId: 'corr' })),
    run: jest.fn((_ctx: unknown, fn: () => unknown) => fn()),
    childSpan: jest.fn(() => ({ end: jest.fn(), context: {} })),
  };
  const metrics: any = { observeQueue: jest.fn() };
  const requestContext: any = { run: jest.fn((_initial: unknown, fn: () => unknown) => fn()) };
  const privacy: any = { processExportJob: jest.fn() };

  const worker = new JobWorker(config, notifications, ai, documents, integrations, recommendations, meetings, search, analytics, commitments, queues, trace, metrics, requestContext, privacy) as any;

  it('routes meetings.transcribe to MeetingsService.regenerateFollowUpCandidates instead of throwing', async () => {
    const result = await worker.process({ name: 'meetings.transcribe', data: { meetingId: 'm1' } });
    expect(meetings.regenerateFollowUpCandidates).toHaveBeenCalledWith('m1');
    expect(result.candidateCount).toBe(2);
  });

  it('throws a clear validation error (not a generic crash) when meetingId is missing', async () => {
    await expect(worker.process({ name: 'meetings.transcribe', data: {} })).rejects.toThrow('meetingId is required');
  });

  it('routes search.reindex to SearchService.reindex instead of throwing', async () => {
    const result = await worker.process({ name: 'search.reindex', data: {} });
    expect(search.reindex).toHaveBeenCalled();
    expect(result.analyzedTables).toContain('Organization');
  });

  it('routes analytics.recompute to AnalyticsService.recompute instead of throwing', async () => {
    const result = await worker.process({ name: 'analytics.recompute', data: {} });
    expect(analytics.recompute).toHaveBeenCalled();
    expect(result.organizationsProcessed).toBe(1);
  });

  it('routes commitments.overdue-sweep to CommitmentsService.sweepOverdue', async () => {
    await worker.process({ name: 'commitments.overdue-sweep', data: {} });
    expect(commitments.sweepOverdue).toHaveBeenCalled();
  });

  it('still throws for a genuinely unknown job name', async () => {
    await expect(worker.process({ name: 'not.a.real.job', data: {} })).rejects.toThrow('Unsupported job name');
  });
});
