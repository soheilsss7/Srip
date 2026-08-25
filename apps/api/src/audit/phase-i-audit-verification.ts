import { AuditAction } from '@prisma/client';
export const PHASE_I_AUDIT_ACTIONS = [
  'CREATE','UPDATE','DELETE','RESTORE','PERMANENT_DELETE','EXPORT','LOGIN','LOGOUT','PERMISSION_CHANGE',
  'APPROVAL','APPROVAL_REQUESTED','APPROVAL_APPROVED','APPROVAL_REJECTED','TOKEN_CHANGE','INTEGRATION_CHANGE',
] as const satisfies readonly AuditAction[];
export const PHASE_I_REQUIREMENTS = { requestContext: ['requestId','correlationId','userId','ip','userAgent'], redactsSecrets: true, directAuditLogWritersOutsideAuditService: 0 };
