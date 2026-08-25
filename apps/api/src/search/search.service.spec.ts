import { SearchService } from './search.service';

describe('SearchService.reindex (Phase 26: real, non-throwing maintenance job)', () => {
  it('runs ANALYZE against every searchable table and reports success', async () => {
    const prisma: any = { $executeRaw: jest.fn().mockResolvedValue(undefined) };
    const authorization: any = {};
    const service = new SearchService(prisma, authorization);
    const result = await service.reindex();
    expect(result.errors).toEqual([]);
    expect(result.analyzedTables.length).toBeGreaterThan(0);
    expect(result.analyzedTables).toContain('Organization');
    expect(result.analyzedTables).toContain('Meeting');
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('does not throw if a single table ANALYZE fails, and reports it instead', async () => {
    const prisma: any = { $executeRaw: jest.fn().mockRejectedValueOnce(new Error('permission denied')).mockResolvedValue(undefined) };
    const authorization: any = {};
    const service = new SearchService(prisma, authorization);
    const result = await service.reindex();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].error).toContain('permission denied');
  });
});
