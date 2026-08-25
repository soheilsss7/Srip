import { FeatureFlagService } from '../../src/common/feature-flags/feature-flag.service';

describe('PHASE Z feature flag runtime contract', () => {
  const prisma = {
    featureFlag: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: FeatureFlagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeatureFlagService(prisma);
  });

  it('supports global enabled flags', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      key: 'new-dashboard', enabled: true, rollout: 100,
      organizationId: null, rolloutOrganizationIds: [], rolloutUserIds: [],
    });
    await expect(service.isEnabled('new-dashboard', {})).resolves.toBe(true);
  });

  it('supports organization rollout', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      key: 'network-graph', enabled: true, rollout: 0,
      organizationId: null, rolloutOrganizationIds: ['org-beta'], rolloutUserIds: [],
    });
    await expect(service.isEnabled('network-graph', { organizationId: 'org-beta' })).resolves.toBe(true);
    await expect(service.isEnabled('network-graph', { organizationId: 'org-other' })).resolves.toBe(false);
  });

  it('supports explicit user rollout', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      key: 'beta', enabled: true, rollout: 0,
      organizationId: null, rolloutOrganizationIds: [], rolloutUserIds: ['user-beta'],
    });
    await expect(service.isEnabled('beta', { userId: 'user-beta' })).resolves.toBe(true);
    await expect(service.isEnabled('beta', { userId: 'user-other' })).resolves.toBe(false);
  });

  it('supports deterministic percentage rollout', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      key: 'experimental', enabled: true, rollout: 50,
      organizationId: null, rolloutOrganizationIds: [], rolloutUserIds: [],
    });
    const first = await service.isEnabled('experimental', { userId: 'stable-user' });
    const second = await service.isEnabled('experimental', { userId: 'stable-user' });
    expect(second).toBe(first);
  });

  it('disabled flags always remain disabled', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue({
      key: 'off', enabled: false, rollout: 100,
      organizationId: 'org-beta', rolloutOrganizationIds: ['org-beta'], rolloutUserIds: ['user-beta'],
    });
    await expect(service.isEnabled('off', { userId: 'user-beta', organizationId: 'org-beta' })).resolves.toBe(false);
  });
});
