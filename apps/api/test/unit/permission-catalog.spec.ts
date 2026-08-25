import { PERMISSIONS, ROLES } from '../../src/common/authorization/access.constants';
import { permissionExists } from '../../src/common/authorization/access-policy';

const expected = [
  'org.read','org.write','org.admin',
  'person.read','person.write','person.delete',
  'relationship.read','relationship.write','relationship.delete',
  'interaction.read','interaction.write','meeting.read','meeting.write',
  'action.read','action.write','commitment.read','commitment.write',
  'project.read','project.write','opportunity.read','opportunity.write',
  'audit.read','security.read',
  'workflow.read','workflow.write','workflow.execute',
  'search.read','search.write','analytics.read','analytics.write',
  'network.read','recommendation.read','recommendation.write',
  'integration.read','integration.write',
  'data.restore','data.permanent_delete','access.manage','role.manage','admin.users',
];

describe('Phase 17 permission catalog completeness', () => {
  it('contains every permission referenced by protected controllers', () => {
    for (const permission of expected) {
      expect(permissionExists(permission)).toBe(true);
      expect(PERMISSIONS).toContain(permission);
    }
  });

  it('does not expose duplicate permission keys', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('keeps role catalog stable', () => {
    expect(ROLES.SUPER_ADMIN).toBe('SUPER_ADMIN');
    expect(ROLES.READ_ONLY).toBe('READ_ONLY');
  });
});
