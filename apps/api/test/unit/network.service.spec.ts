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
});
