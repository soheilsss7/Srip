import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PHASE AR reconciliation freeze', () => {
  const root = join(__dirname, '../../../..');
  const api = join(root, 'apps/api');

  const paths = [
    'prisma/schema.prisma',
    'src/auth/auth.service.ts',
    'src/common/mfa/mfa.service.ts',
    'src/common/authorization/authorization.service.ts',
    'src/scoring/relationship-score.service.ts',
    'src/network/network.service.ts',
    'src/search/search.service.ts',
    'src/notifications/notification-rule-engine.service.ts',
    'src/workflows/workflows.service.ts',
    'src/event-bus/event-bus.service.ts',
    'src/data-management/data-import.service.ts',
    'src/common/data-lifecycle/data-lifecycle.service.ts',
    'src/common/security/secret-encryption.service.ts',
    'src/observability/trace.service.ts',
  ];

  it('keeps every frozen foundation on a canonical path', () => {
    for (const relative of paths) {
      expect(existsSync(join(api, relative))).toBe(true);
    }
  });

  it('keeps the central lifecycle and event foundations intact', () => {
    const lifecycle = readFileSync(join(api, 'src/common/data-lifecycle/data-lifecycle.service.ts'), 'utf8');
    const eventBus = readFileSync(join(api, 'src/event-bus/event-bus.service.ts'), 'utf8');
    expect(lifecycle).toContain('softDelete');
    expect(lifecycle).toContain('restore');
    expect(lifecycle).toContain('permanentDelete');
    expect(eventBus).toContain('publish');
  });
});
