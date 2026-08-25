import { BadRequestException } from '@nestjs/common';
import { WorkflowsService } from '../../src/workflows/workflows.service';

describe('Phase 17 workflow regression', () => {
  const service = new WorkflowsService({} as any, {} as any) as any;

  it('accepts supported workflow actions and rejects unsupported actions', () => {
    expect(() => service.validateDefinition({ actions: [{ type: 'CREATE_NOTIFICATION' }] })).not.toThrow();
    expect(() => service.validateDefinition({ actions: [{ type: 'REQUEST_APPROVAL' }] })).not.toThrow();
    expect(() => service.validateDefinition({ actions: [{ type: 'DELETE_DATABASE' }] })).toThrow(BadRequestException);
  });

  it('evaluates nested conditions deterministically', () => {
    expect(service.conditionsPass([{ path: 'meeting.outcome', equals: 'POSITIVE' }], { meeting: { outcome: 'POSITIVE' } })).toBe(true);
    expect(service.conditionsPass([{ path: 'meeting.outcome', equals: 'POSITIVE' }], { meeting: { outcome: 'NEGATIVE' } })).toBe(false);
    expect(service.conditionsPass([{ path: 'risk.score', exists: true }], { risk: { score: 0 } })).toBe(true);
    expect(service.conditionsPass([{ path: 'risk.score', exists: false }], { risk: {} })).toBe(true);
    expect(service.conditionsPass([{ path: 'status', notEquals: 'CLOSED' }], { status: 'OPEN' })).toBe(true);
  });
});
