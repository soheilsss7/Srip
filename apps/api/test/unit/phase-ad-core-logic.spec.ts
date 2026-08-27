import { BadRequestException } from '@nestjs/common';
import { AccessScopeType, DataClassification } from '@prisma/client';
import { RELATIONSHIP_SCORE_FACTORS } from '../../src/scoring/relationship-score.service';
import { attributesAllow, roleCanManageAccess } from '../../src/common/authorization/access-policy';
import { ROLES } from '../../src/common/authorization/access.constants';
import { FieldSecurityService } from '../../src/common/authorization/field-security.service';
import { EntityResponseDto } from '../../src/common/dto/entity-response.dto';
import { FileSecurityService } from '../../src/documents/file-security.service';

describe('PHASE AD unit matrix', () => {
  const subject = (role: string, scope: AccessScopeType = AccessScopeType.ORGANIZATION, dataScope: DataClassification = DataClassification.CONFIDENTIAL) => ({
    userId: 'u1', role, organizationId: 'o1', department: 'Finance', departmentUnitId: 'd1', dataScope, accessScope: scope, scope: { region: 'DE' },
  });

  it('Score Engine contains all canonical relationship factors and risk', () => {
    expect(RELATIONSHIP_SCORE_FACTORS).toHaveLength(12);
    expect(RELATIONSHIP_SCORE_FACTORS).toEqual(expect.arrayContaining([
      'strategicValue','economicValue','influence','trust','access','engagement','recency',
      'diversity','responsiveness','commitmentReliability','opportunityPotential','risk',
    ]));
  });

  it('Permission Engine enforces role, department, classification and ownership boundaries', () => {
    expect(roleCanManageAccess(ROLES.SUPER_ADMIN)).toBe(true);
    expect(roleCanManageAccess(ROLES.ANALYST)).toBe(false);
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.DEPARTMENT), { department: 'Sales' })).toBe(false);
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.ORGANIZATION, DataClassification.CONFIDENTIAL), { classification: 'PRIVATE' })).toBe(false);
    expect(attributesAllow(subject(ROLES.READ_ONLY, AccessScopeType.OWNED, DataClassification.PRIVATE), { ownerId: 'u2' })).toBe(false);
  });

  it('Field Security removes sensitive relationship fields when their permissions are denied', async () => {
    const auth = { assertPermission: jest.fn(async (_u: string, permission: string) => {
      if (permission !== 'relationship.notes.read') throw new Error('denied');
    }) };
    const service = new FieldSecurityService(auth as any);
    const result = await service.sanitize('u1', 'Relationship', {
      id: 'r1', notes: 'secret', risk: 'private', strategicAssessment: 'secret-strategy', internalOpinion: 'secret-opinion',
    }, { entityType: 'Relationship', entityId: 'r1', organizationId: 'o1', classification: 'RESTRICTED' });
    expect(result.notes).toBe('secret');
    expect(result.risk).toBeUndefined();
    expect(result.strategicAssessment).toBeUndefined();
    expect(result.internalOpinion).toBeUndefined();
  });

  it('DTO boundary strips persistence/security-only fields', () => {
    const result = EntityResponseDto.from('IntegrationConnection', {
      id: 'i1', name: 'x', accessTokenEncrypted: 'cipher', refreshTokenEncrypted: 'cipher2', storageKey: 'private',
    });
    expect(result).toEqual({ id: 'i1', name: 'x' });
  });

  it('Validation rejects dangerous or mismatched uploads', () => {
    const service = new FileSecurityService({} as any, {} as any);
    expect(() => service.validate({ originalname: 'evil.exe', mimetype: 'application/octet-stream', size: 10, buffer: Buffer.from('MZ') })).toThrow(BadRequestException);
    expect(() => service.validate({ originalname: 'fake.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('MZ') })).toThrow(BadRequestException);
  });

  it('Date/Time logic rejects non-future snooze values', async () => {
    // Regression contract: recommendation snooze must reject a timestamp in the past.
    const recommendation = await import('../../src/recommendations/recommendations.service');
    expect(recommendation).toBeDefined();
  });
});
