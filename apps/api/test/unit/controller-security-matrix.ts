export type ControllerSecurityCategory =
  | 'PUBLIC'
  | 'AUTHENTICATED'
  | 'AUTHORIZED'
  | 'INTERNAL'
  | 'WEBHOOK_SIGNED'
  | 'HEALTH';

export type ControllerSecurityRule = {
  category: ControllerSecurityCategory;
  /** Guards required somewhere in the controller source. */
  requiredGuards?: string[];
  /** Permission metadata/decorator required for AUTHORIZED controllers. */
  requirePermission?: boolean;
  /** Explicitly documented route-level exceptions. */
  exceptions?: string[];
};

/**
 * Canonical controller security classification.
 * Every backend controller must have exactly one entry here.
 */
export const CONTROLLER_SECURITY_MATRIX: Record<string, ControllerSecurityRule> = {
  'actions.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'admin.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'ai.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'analytics.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'approval.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'audit.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'auth.controller.ts': { category: 'PUBLIC', exceptions: ['POST auth/email/resend requires AuthGuard'] },
  'authorization-admin.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'commitments.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'data-lifecycle.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'mfa.controller.ts': { category: 'AUTHENTICATED', requiredGuards: ['AuthGuard'] },
  'custom-fields.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'data-management.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'documents.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'enterprise.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'health.controller.ts': { category: 'HEALTH' },
  'integration-webhook.controller.ts': { category: 'WEBHOOK_SIGNED', requiredGuards: ['WebhookSignatureGuard'] },
  'integrations.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'intelligence.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'interactions.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'meetings.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'metrics.controller.ts': { category: 'INTERNAL', requiredGuards: ['InternalMetricsGuard'] },
  'network.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'notifications.controller.ts': { category: 'AUTHENTICATED', requiredGuards: ['AuthGuard'] },
  'notification-alerts.controller.ts': { category: 'AUTHENTICATED', requiredGuards: ['AuthGuard'] },
  'notes.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'observability.controller.ts': { category: 'INTERNAL', requiredGuards: ['InternalMetricsGuard'] },
  'opportunities.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'core-domain.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'organizations.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'people.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'privacy.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'projects.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'recommendations.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'relationship-score.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'relationships.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'reporting.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'requirements.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'scoring.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'search.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'security.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'sessions.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'tags.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'users.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
  'workflows.controller.ts': { category: 'AUTHORIZED', requiredGuards: ['AuthGuard','AuthorizationGuard'], requirePermission: true },
};
