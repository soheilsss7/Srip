import { FieldSecurityService } from './field-security.service';

describe('FieldSecurityService', () => {
  it('defines the required enterprise sensitive relationship fields', () => {
    const service = new FieldSecurityService({ assertPermission: jest.fn() } as any);
    expect(service.rulesFor('Relationship').map(x => x.field)).toEqual(expect.arrayContaining([
      'notes', 'strategicAssessment', 'risk', 'internalOpinion', 'sensitiveContacts', 'strategicScore', 'riskScore',
    ]));
  });

  it('does not alter ordinary fields', async () => {
    const auth = { assertPermission: jest.fn().mockResolvedValue(true) };
    const service = new FieldSecurityService(auth as any);
    const result = await service.sanitize('u1', 'Relationship', { id: 'r1', status: 'ACTIVE' }, { organizationId: 'o1', entityType: 'Relationship', entityId: 'r1' });
    expect(result).toEqual({ id: 'r1', status: 'ACTIVE' });
    expect(auth.assertPermission).not.toHaveBeenCalled();
  });

  it('removes a protected field when its field permission is denied', async () => {
    const auth = { assertPermission: jest.fn().mockImplementation((_u: string, permission: string) => permission === 'relationship.risk.read' ? Promise.reject(new Error('denied')) : Promise.resolve(true)) };
    const service = new FieldSecurityService(auth as any);
    const result = await service.sanitize('u1', 'Relationship', { id: 'r1', riskScore: 80, status: 'ACTIVE' }, { organizationId: 'o1', entityType: 'Relationship', entityId: 'r1' });
    expect(result).toEqual({ id: 'r1', status: 'ACTIVE' });
  });
});
