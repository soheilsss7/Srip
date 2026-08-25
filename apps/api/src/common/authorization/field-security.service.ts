import { Injectable } from '@nestjs/common';
import { AuthorizationService, AuthorizationContext } from './authorization.service';

type FieldRule = { field: string; permission: string };

const FIELD_POLICIES: Record<string, FieldRule[]> = {
  Relationship: [
    { field: 'notes', permission: 'relationship.notes.read' },
    { field: 'strategicAssessment', permission: 'relationship.strategic.read' },
    { field: 'strategicScore', permission: 'relationship.strategic.read' },
    { field: 'risk', permission: 'relationship.risk.read' },
    { field: 'riskScore', permission: 'relationship.risk.read' },
    { field: 'internalOpinion', permission: 'relationship.internal.read' },
    { field: 'sensitiveContacts', permission: 'relationship.sensitive_contacts.read' },
  ],
  Person: [
    { field: 'sensitiveContacts', permission: 'person.sensitive_contacts.read' },
  ],
};

@Injectable()
export class FieldSecurityService {
  constructor(private readonly authorization: AuthorizationService) {}

  rulesFor(entityType: string): FieldRule[] { return FIELD_POLICIES[entityType] ?? []; }

  async canReadField(userId: string, entityType: string, field: string, context: AuthorizationContext): Promise<boolean> {
    const rule = this.rulesFor(entityType).find(x => x.field === field);
    if (!rule) return true;
    try {
      await this.authorization.assertPermission(userId, rule.permission, { ...context, entityType, field });
      return true;
    } catch { return false; }
  }

  async sanitize<T extends Record<string, any>>(userId: string, entityType: string, value: T, context: AuthorizationContext): Promise<Partial<T>> {
    const out: Record<string, any> = { ...value };
    for (const rule of this.rulesFor(entityType)) {
      if (!(rule.field in out)) continue;
      if (!(await this.canReadField(userId, entityType, rule.field, context))) delete out[rule.field];
    }
    return out as Partial<T>;
  }

  async sanitizeMany<T extends Record<string, any>>(userId: string, entityType: string, values: T[], contextFor: (value: T) => AuthorizationContext): Promise<Partial<T>[]> {
    return Promise.all(values.map(value => this.sanitize(userId, entityType, value, contextFor(value))));
  }
}
