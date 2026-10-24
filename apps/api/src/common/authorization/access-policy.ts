import { AccessScopeType, DataClassification } from '@prisma/client';
import { PERMISSIONS, ROLES, classificationAllows } from './access.constants';

export type AccessAttributes = {
  organizationId?: string | null;
  department?: string | null;
  departmentUnitId?: string | null;
  classification?: DataClassification | string | null;
  sensitivity?: DataClassification | string | null;
  ownerId?: string | null;
  createdById?: string | null;
  visibility?: 'SHARED' | 'PRIVATE' | 'RESTRICTED' | string | null;
  subjectScope?: AccessScopeType | string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  relationshipOrganizationIds?: string[];
  [key: string]: unknown;
};

export type AuthorizationSubject = {
  userId: string;
  role: string;
  organizationId: string;
  department?: string | null;
  departmentUnitId?: string | null;
  dataScope: DataClassification;
  accessScope: AccessScopeType;
  scope?: Record<string, unknown> | null;
};

export type Condition = {
  field?: string;
  op?: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'startsWith' | 'exists' | 'gte' | 'lte';
  value?: unknown;
};

export function permissionExists(permission: string) {
  return PERMISSIONS.includes(permission as (typeof PERMISSIONS)[number]);
}

export function roleCanManageAccess(role: string) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.HOLDING_ADMIN || role === ROLES.SUBSIDIARY_ADMIN;
}

export function roleRank(role: string) {
  const ranks: Record<string, number> = {
    READ_ONLY: 10, STANDARD_USER: 20, ANALYST: 30, RELATIONSHIP_MANAGER: 40, PROJECT_MANAGER: 40,
    SUBSIDIARY_EXECUTIVE: 50, SUBSIDIARY_ADMIN: 60, HOLDING_EXECUTIVE: 70, HOLDING_ADMIN: 80, SUPER_ADMIN: 100,
  };
  return ranks[role] ?? 0;
}

export function canGrantRole(actorRole: string, targetRole: string) {
  if (actorRole === ROLES.SUPER_ADMIN) return true;
  if (!roleCanManageAccess(actorRole)) return false;
  if (targetRole === ROLES.SUPER_ADMIN) return false;
  if (actorRole === ROLES.SUBSIDIARY_ADMIN) return roleRank(targetRole) <= roleRank(ROLES.SUBSIDIARY_EXECUTIVE);
  if (actorRole === ROLES.HOLDING_ADMIN) return roleRank(targetRole) <= roleRank(ROLES.SUBSIDIARY_ADMIN);
  return false;
}

export function resolveField(subject: AuthorizationSubject, attributes: AccessAttributes, field: string): unknown {
  if (field.startsWith('subject.')) return subject[field.slice(8) as keyof AuthorizationSubject];
  if (field.startsWith('resource.')) return attributes[field.slice(9)];
  if (field.startsWith('scope.')) return subject.scope?.[field.slice(6)];
  return attributes[field] ?? subject[field as keyof AuthorizationSubject];
}

export function evaluateCondition(subject: AuthorizationSubject, attributes: AccessAttributes, condition: Condition): boolean {
  if (!condition.field || !condition.op) return false;
  const actual = resolveField(subject, attributes, condition.field);
  switch (condition.op) {
    case 'eq': return actual === condition.value;
    case 'neq': return actual !== condition.value;
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual);
    case 'notIn': return Array.isArray(condition.value) && !condition.value.includes(actual);
    case 'contains': return Array.isArray(actual) ? actual.includes(condition.value) : typeof actual === 'string' && actual.includes(String(condition.value));
    case 'startsWith': return typeof actual === 'string' && actual.startsWith(String(condition.value));
    case 'exists': return condition.value === Boolean(actual !== undefined && actual !== null);
    case 'gte': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value;
    case 'lte': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
    default: return false;
  }
}

export function evaluateConditions(subject: AuthorizationSubject, attributes: AccessAttributes, conditions: unknown): boolean {
  if (!conditions) return true;
  if (Array.isArray(conditions)) return conditions.every(c => evaluateCondition(subject, attributes, c as Condition));
  if (typeof conditions !== 'object') return false;
  const c = conditions as { all?: unknown[]; any?: unknown[]; not?: unknown; conditions?: unknown[]; field?: string; op?: string; value?: unknown };
  if (c.all && !c.all.every(x => evaluateConditions(subject, attributes, x))) return false;
  if (c.any && !c.any.some(x => evaluateConditions(subject, attributes, x))) return false;
  if (c.not && evaluateConditions(subject, attributes, c.not)) return false;
  if (c.conditions && !c.conditions.every(x => evaluateConditions(subject, attributes, x))) return false;
  if (typeof c.field === 'string' && typeof c.op === 'string') return evaluateCondition(subject, attributes, c as Condition);
  return true;
}

export function attributesAllow(subject: AuthorizationSubject, attributes: AccessAttributes = {}) {
  const requested = attributes.classification ?? attributes.sensitivity;
  if (requested && !classificationAllows(subject.dataScope, String(requested))) return false;
  if (attributes.departmentUnitId && subject.departmentUnitId && attributes.departmentUnitId !== subject.departmentUnitId && subject.accessScope === AccessScopeType.DEPARTMENT) return false;
  if (attributes.department && subject.department && attributes.department !== subject.department && subject.accessScope === AccessScopeType.DEPARTMENT) return false;
  if (subject.accessScope === AccessScopeType.OWNED && attributes.ownerId !== subject.userId && attributes.createdById !== subject.userId) return false;
  if (subject.accessScope === AccessScopeType.PRIVATE && attributes.ownerId !== subject.userId && attributes.createdById !== subject.userId) return false;
  if (attributes.visibility === 'PRIVATE' && attributes.ownerId !== subject.userId && attributes.createdById !== subject.userId) return false;
  if (attributes.visibility === 'RESTRICTED' && subject.accessScope === AccessScopeType.SHARED) return false;
  return true;
}
