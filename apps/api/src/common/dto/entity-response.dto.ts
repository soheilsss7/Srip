/**
 * Phase G — API DTO boundary.
 *
 * Services must never expose a Prisma result directly. This DTO performs a
 * defensive copy and strips persistence/security-only fields before a value
 * crosses the service -> controller boundary.
 */
export type EntityResponse = Record<string, unknown>;

const GLOBAL_BLOCKED_KEYS = new Set([
  'passwordHash',
  'refreshTokenHash',
  'accessToken',
  'refreshToken',
  'accessTokenEncrypted',
  'refreshTokenEncrypted',
  'secretEncrypted',
  'secret',
  'tokenHash',
  'codeHash',
  'storageKey',
  'deletedById',
  'deletedBy',
  'processingLeaseId',
  'processingHeartbeatAt',
]);

const ENTITY_BLOCKED_KEYS: Record<string, Set<string>> = {
  User: new Set(['passwordHash', 'refreshTokenHash']),
  Account: new Set(['accessToken', 'refreshToken', 'accessTokenEncrypted', 'refreshTokenEncrypted']),
  IntegrationConnection: new Set(['accessTokenEncrypted', 'refreshTokenEncrypted']),
  Document: new Set(['storageKey']),
  MfaDevice: new Set(['secretEncrypted']),
  RecoveryCode: new Set(['codeHash']),
  Session: new Set(['refreshTokenHash']),
};

function clone(value: unknown, entityType?: string): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => clone(item, entityType));

  const blocked = new Set(GLOBAL_BLOCKED_KEYS);
  for (const key of ENTITY_BLOCKED_KEYS[entityType ?? ''] ?? []) blocked.add(key);

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.has(key)) continue;
    // Never leak Prisma's internal relation metadata.
    if (key === '__typename' || key.startsWith('_prisma')) continue;
    out[key] = clone(item, undefined);
  }
  return out;
}

export class EntityResponseDto {
  static from<T extends Record<string, unknown>>(entityType: string, value: T): EntityResponse {
    return clone(value, entityType) as EntityResponse;
  }

  static many<T extends Record<string, unknown>>(entityType: string, values: T[]): EntityResponse[] {
    return values.map(value => this.from(entityType, value));
  }

  static fromUnknown<T>(value: T): EntityResponse {
    return clone(value, 'Unknown') as EntityResponse;
  }

  static manyUnknown<T>(values: T[]): EntityResponse[] {
    return values.map(value => this.fromUnknown(value));
  }
}

/** Explicit contract for Relationship responses. Sensitive fields are still
 * filtered by FieldSecurityService before this DTO reaches the controller. */
export class RelationshipResponseDto extends EntityResponseDto {}

/** Explicit contract for common CRUD entities. */
export class OrganizationResponseDto extends EntityResponseDto {}
export class PersonResponseDto extends EntityResponseDto {}
export class InteractionResponseDto extends EntityResponseDto {}
export class MeetingResponseDto extends EntityResponseDto {}
export class ActionResponseDto extends EntityResponseDto {}
export class CommitmentResponseDto extends EntityResponseDto {}
export class ProjectResponseDto extends EntityResponseDto {}
export class OpportunityResponseDto extends EntityResponseDto {}
export class RequirementResponseDto extends EntityResponseDto {}
export class RecommendationResponseDto extends EntityResponseDto {}
export class NotificationResponseDto extends EntityResponseDto {}
export class TagResponseDto extends EntityResponseDto {}
export class CustomFieldResponseDto extends EntityResponseDto {}
export class DocumentResponseDto extends EntityResponseDto {}
