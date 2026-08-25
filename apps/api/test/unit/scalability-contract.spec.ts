import { readFileSync } from 'node:fs';

describe('PHASE AM scalability contract', () => {
  it('keeps graph and relationship matching bounded', () => {
    const network = readFileSync('src/network/network.service.ts', 'utf8');
    const matching = readFileSync('src/requirements/requirement-matching.service.ts', 'utf8');
    expect(network).toContain('bounded:true');
    expect(network).toContain('take: pageSize + 1');
    expect(matching).toContain('findPath(source, candidate.org.id, adjacency, 2)');
    expect(matching).toContain('take: Math.max(1000, Math.min(5000, limit * 100))');
  });
});
