import { AccessScopeType, DataClassification } from '@prisma/client';
import { attributesAllow, canGrantRole, evaluateConditions, permissionExists, roleCanManageAccess } from './access-policy';
import { ROLES } from './access.constants';

describe('Phase 22 RBAC/ABAC policy engine', () => {
  const subject = (role: string, scope: AccessScopeType = AccessScopeType.ORGANIZATION, dataScope: DataClassification = DataClassification.CONFIDENTIAL) => ({
    userId: 'u1', role, organizationId: 'o1', department: 'Finance', departmentUnitId: 'd1', dataScope, accessScope: scope, scope: { region: 'DE' },
  });

  it('recognizes only catalogued permissions', () => {
    expect(permissionExists('person.read')).toBe(true);
    expect(permissionExists('does.not.exist')).toBe(false);
  });

  it('limits access management to admin roles', () => {
    expect(roleCanManageAccess(ROLES.HOLDING_ADMIN)).toBe(true);
    expect(roleCanManageAccess(ROLES.SUBSIDIARY_ADMIN)).toBe(true);
    expect(roleCanManageAccess(ROLES.ANALYST)).toBe(false);
  });

  it('enforces department, classification and ownership attributes', () => {
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.DEPARTMENT), { department: 'Sales' })).toBe(false);
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.ORGANIZATION, DataClassification.CONFIDENTIAL), { classification: 'PRIVATE' })).toBe(false);
    expect(attributesAllow(subject(ROLES.READ_ONLY, AccessScopeType.OWNED, DataClassification.PRIVATE), { ownerId: 'u2' })).toBe(false);
    expect(attributesAllow(subject(ROLES.HOLDING_ADMIN, AccessScopeType.ORGANIZATION, DataClassification.PRIVATE), { department: 'Sales', classification: 'PRIVATE' })).toBe(true);
  });

  it('enforces grant hierarchy', () => {
    expect(canGrantRole(ROLES.SUBSIDIARY_ADMIN, ROLES.SUBSIDIARY_EXECUTIVE)).toBe(true);
    expect(canGrantRole(ROLES.SUBSIDIARY_ADMIN, ROLES.SUBSIDIARY_ADMIN)).toBe(false);
    expect(canGrantRole(ROLES.HOLDING_ADMIN, ROLES.SUBSIDIARY_ADMIN)).toBe(true);
    expect(canGrantRole(ROLES.HOLDING_ADMIN, ROLES.SUPER_ADMIN)).toBe(false);
  });

  it('evaluates declarative ABAC conditions', () => {
    expect(evaluateConditions(subject(ROLES.ANALYST), { resourceType: 'Project', classification: 'INTERNAL' }, { all: [
      { field: 'subject.role', op: 'eq', value: ROLES.ANALYST },
      { field: 'resource.resourceType', op: 'eq', value: 'Project' },
    ] })).toBe(true);
    expect(evaluateConditions(subject(ROLES.ANALYST), { classification: 'PRIVATE' }, { field: 'resource.classification', op: 'eq', value: 'PUBLIC' })).toBe(false);
  });
});
