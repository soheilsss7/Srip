import { InteractionsService } from './interactions.service';

describe('InteractionsService contract', () => {
  it('exposes timeline and follow-up aware list behavior', () => {
    expect(typeof InteractionsService.prototype.list).toBe('function');
    expect(typeof InteractionsService.prototype.timeline).toBe('function');
    expect(typeof InteractionsService.prototype.create).toBe('function');
    expect(typeof InteractionsService.prototype.update).toBe('function');
    expect(typeof InteractionsService.prototype.remove).toBe('function');
  });
});
