import { AccessScopeType, DataClassification } from '@prisma/client';
import { attributesAllow, permissionExists, roleCanManageAccess } from '../../src/common/authorization/access-policy';
import { ROLES } from '../../src/common/authorization/access.constants';

describe('Phase 17 authorization regression', () => {
  const subject = (role: string, scope: AccessScopeType = AccessScopeType.ORGANIZATION, dataScope: DataClassification = DataClassification.CONFIDENTIAL) => ({
    userId: 'u1', role, organizationId: 'o1', department: 'Finance', departmentUnitId: 'd1', dataScope, accessScope: scope, scope: { region: 'DE' },
  });

  it('rejects unknown permissions', () => {
    expect(permissionExists('person.read')).toBe(true);
    expect(permissionExists('security.root')).toBe(false);
  });

  it('keeps access-management roles restricted', () => {
    expect(roleCanManageAccess(ROLES.SUPER_ADMIN)).toBe(true);
    expect(roleCanManageAccess(ROLES.HOLDING_ADMIN)).toBe(true);
    expect(roleCanManageAccess(ROLES.ANALYST)).toBe(false);
    expect(roleCanManageAccess(ROLES.READ_ONLY)).toBe(false);
  });

  it('blocks department, classification and read-only ownership violations', () => {
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.DEPARTMENT), { department: 'Sales' })).toBe(false);
    expect(attributesAllow(subject(ROLES.ANALYST, AccessScopeType.ORGANIZATION, DataClassification.CONFIDENTIAL), { classification: 'PRIVATE' })).toBe(false);
    expect(attributesAllow(subject(ROLES.READ_ONLY, AccessScopeType.OWNED, DataClassification.PRIVATE), { ownerId: 'u2' })).toBe(false);
    expect(attributesAllow(subject(ROLES.HOLDING_ADMIN, AccessScopeType.ORGANIZATION, DataClassification.PRIVATE), { department: 'Sales', classification: 'PRIVATE' })).toBe(true);
  });
});