import { NetworkService } from '../../src/network/network.service';

describe('NetworkService algorithms', () => {
  const service = Object.create(NetworkService.prototype) as NetworkService;
  it('computes connected components correctly', () => {
    const edges:any[] = [{source:'a',target:'b'},{source:'b',target:'c'}];
    expect((service as any).componentCount(['a','b','c'], edges)).toBe(1);
    expect((service as any).componentCount(['a','b','c'], [])).toBe(3);
  });
  it('isolates a bridge node when its removal fragments the graph', () => {
    const edges:any[] = [{source:'a',target:'b'},{source:'b',target:'c'}];
    const baseline=(service as any).componentCount(['a','b','c'],edges);
    const after=(service as any).componentCount(['a','c'],[]);
    expect(after-baseline).toBe(1);
  });
  it('connectors passes the bare person UUID (person: prefix stripped) to connectorScore.calculate', async () => {
    const person = { id: 'person:11111111-1111-1111-1111-111111111111', type: 'person' };
    const graph = {
      nodes: [person, { id: 'org:22222222-2222-2222-2222-222222222222', type: 'organization' }],
      edges: [],
    };
    const seen: string[] = [];
    (service as any).graph = async () => graph;
    (service as any).connectorScore = { calculate: async (_u: string, id: string) => { seen.push(id); return { score: 42, version: 3, factors: { totalConnections: 0 } }; } };
    const result: any = await (service as any).connectors('user-1');
    expect(seen).toEqual(['11111111-1111-1111-1111-111111111111']);
    expect(result[0].node).toEqual(person);
    expect(result[0].connectorScore).toBe(42);
  });
});
