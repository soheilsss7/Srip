import { attributesAllow, permissionExists, roleCanManageAccess } from '../../src/common/authorization/access-policy';
import { ROLES } from '../../src/common/authorization/access.constants';

describe('Phase 17 authorization regression', () => {
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
    expect(attributesAllow(ROLES.ANALYST, 'Finance', 'CONFIDENTIAL', 'u1', { department: 'Sales' })).toBe(false);
    expect(attributesAllow(ROLES.ANALYST, 'Finance', 'CONFIDENTIAL', 'u1', { classification: 'PRIVATE' })).toBe(false);
    expect(attributesAllow(ROLES.READ_ONLY, null, 'PRIVATE', 'u1', { ownerId: 'u2' })).toBe(false);
    expect(attributesAllow(ROLES.HOLDING_ADMIN, 'Finance', 'PRIVATE', 'u1', { department: 'Sales', classification: 'PRIVATE' })).toBe(true);
  });
});
