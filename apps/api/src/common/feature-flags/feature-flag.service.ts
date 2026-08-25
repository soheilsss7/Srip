import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export type FeatureFlagContext = {
  userId?: string;
  organizationId?: string;
};

/**
 * Runtime Feature Flag consumer.
 *
 * Targeting rules are evaluated deterministically and without randomness:
 * - organization targeting: the current organization must be explicitly targeted;
 * - user targeting: the current user must be explicitly targeted;
 * - percentage targeting: a stable hash of flag key + user/org identity is used.
 *
 * If at least one targeting rule is configured, a matching rule enables the flag.
 * If no targeting rule is configured, the flag's enabled value is authoritative.
 */
@Injectable()
export class FeatureFlagService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string, context: FeatureFlagContext = {}): Promise<boolean> {
    const normalizedKey = key?.trim();
    if (!normalizedKey) return false;

    const flag = await this.prisma.featureFlag.findUnique({ where: { key: normalizedKey } });
    if (!flag || !flag.enabled) return false;

    const organizationIds = new Set<string>(flag.rolloutOrganizationIds ?? []);
    if (flag.organizationId) organizationIds.add(flag.organizationId);

    const userIds = new Set<string>(flag.rolloutUserIds ?? []);
    const hasOrganizationRollout = organizationIds.size > 0;
    const hasUserRollout = userIds.size > 0;
    const hasPercentageRollout = flag.rollout < 100;
    const hasTargeting = hasOrganizationRollout || hasUserRollout || hasPercentageRollout;

    // enabled=true with no targeting means a globally enabled flag.
    if (!hasTargeting) return true;

    // Explicit targets are evaluated first. This allows a small beta group to
    // receive a feature even when the percentage rollout is otherwise small.
    if (context.organizationId && organizationIds.has(context.organizationId)) return true;
    if (context.userId && userIds.has(context.userId)) return true;

    if (flag.rollout <= 0) return false;
    if (flag.rollout >= 100) return Boolean(context.userId || context.organizationId);

    // Percentage rollout must be stable for the same actor and flag. Never use
    // Math.random(), otherwise one request could disagree with the next request.
    const identity = context.userId
      ? `user:${context.userId}`
      : context.organizationId
        ? `organization:${context.organizationId}`
        : undefined;
    if (!identity) return false;

    const bucket = this.bucket(normalizedKey, identity);
    return bucket < flag.rollout;
  }

  private bucket(key: string, identity: string): number {
    const digest = createHash('sha256').update(`${key}:${identity}`).digest();
    // 0..99, uniformly distributed enough for deterministic rollout targeting.
    return digest.readUInt32BE(0) % 100;
  }
}
