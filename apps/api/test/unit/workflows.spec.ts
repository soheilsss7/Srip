import { BadRequestException } from '@nestjs/common';
import { WorkflowsService } from '../../src/workflows/workflows.service';

describe('Phase 17 workflow regression', () => {
  const notifications: any = { create: jest.fn() };
  const eventBus: any = { transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})), publishInTransaction: jest.fn() };
  const audit: any = { logMutation: jest.fn() };
  const requestContext: any = { run: jest.fn(), requestId: undefined, correlationId: undefined };
  const trace: any = { childSpan: jest.fn(() => ({ end: jest.fn() })) };
  const workflowApprovals: any = { request: jest.fn(), decide: jest.fn() };
  const service = new WorkflowsService({} as any, {} as any, notifications, eventBus, audit, requestContext, trace, workflowApprovals) as any;

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
