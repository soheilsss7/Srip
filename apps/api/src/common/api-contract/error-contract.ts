export const API_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  ACCESS_DENIED: 'ACCESS_DENIED',
  ORG_SCOPE_DENIED: 'ORG_SCOPE_DENIED',
  FIELD_ACCESS_DENIED: 'FIELD_ACCESS_DENIED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INTEGRATION_ERROR: 'INTEGRATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details: Record<string, unknown>;
  };
}

const STABLE_CODES = new Set<string>(Object.values(API_ERROR_CODES));

const SENSITIVE_DETAIL_KEYS = new Set(['password','passwordHash','token','accessToken','refreshToken','accessTokenEncrypted','refreshTokenEncrypted','secret','clientSecret','apiKey','privateKey','recoveryCodes','oauthStateHash']);

function sanitizeDetailValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeDetailValue(item, depth + 1));
  if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  const input = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(input).filter(([key]) => !SENSITIVE_DETAIL_KEYS.has(key)).slice(0, 100).map(([key, item]) => [key, sanitizeDetailValue(item, depth + 1)]));
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeApiErrorCode(status: number, raw: unknown, message: string): ApiErrorCode {
  const candidate = isRecord(raw) && typeof raw.code === 'string' ? raw.code : undefined;
  if (candidate && STABLE_CODES.has(candidate)) return candidate as ApiErrorCode;

  if (candidate === 'IDEMPOTENCY_KEY_REUSED' || candidate === 'IDEMPOTENCY_REQUEST_IN_PROGRESS' || candidate === 'IDEMPOTENCY_KEY_REQUIRED') return API_ERROR_CODES.IDEMPOTENCY_CONFLICT;
  if (candidate === 'UNAUTHENTICATED' || candidate === 'UNAUTHORIZED' || candidate === 'AUTHENTICATION_REQUIRED') return API_ERROR_CODES.AUTH_REQUIRED;
  if (candidate === 'FORBIDDEN') return API_ERROR_CODES.ACCESS_DENIED;
  if (candidate === 'NOT_FOUND') return API_ERROR_CODES.RESOURCE_NOT_FOUND;
  if (candidate === 'CONFLICT') return API_ERROR_CODES.DUPLICATE_RESOURCE;
  if (candidate === 'UNPROCESSABLE_ENTITY' || candidate === 'BAD_REQUEST') return API_ERROR_CODES.VALIDATION_ERROR;
  if (candidate === 'RATE_LIMITED') return API_ERROR_CODES.RATE_LIMITED;
  if (candidate === 'APPROVAL_REQUIRED') return API_ERROR_CODES.APPROVAL_REQUIRED;
  if (candidate === 'INTEGRATION_ERROR') return API_ERROR_CODES.INTEGRATION_ERROR;

  if (status === 401) {
    return /expired|invalid|malformed|token|refresh|credential/i.test(message) ? API_ERROR_CODES.AUTH_INVALID : API_ERROR_CODES.AUTH_REQUIRED;
  }
  if (status === 403) {
    if (/field|column/i.test(message)) return API_ERROR_CODES.FIELD_ACCESS_DENIED;
    if (/organization|org|scope/i.test(message)) return API_ERROR_CODES.ORG_SCOPE_DENIED;
    return API_ERROR_CODES.ACCESS_DENIED;
  }
  if (status === 404) return API_ERROR_CODES.RESOURCE_NOT_FOUND;
  if (status === 409) return API_ERROR_CODES.DUPLICATE_RESOURCE;
  if (status === 422 || status === 400) return API_ERROR_CODES.VALIDATION_ERROR;
  if (status === 429) return API_ERROR_CODES.RATE_LIMITED;
  if (status === 503) return API_ERROR_CODES.SERVICE_UNAVAILABLE;
  if (status >= 500 && /integration|provider|oauth|webhook/i.test(message)) return API_ERROR_CODES.INTEGRATION_ERROR;
  if (status >= 500) return API_ERROR_CODES.INTERNAL_ERROR;
  return API_ERROR_CODES.VALIDATION_ERROR;
}

export function normalizeApiErrorDetails(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const details = raw.details;
  if (isRecord(details)) return sanitizeDetailValue(details) as Record<string, unknown>;
  if (Array.isArray(details)) return { errors: sanitizeDetailValue(details) };
  if (details !== undefined) return { value: sanitizeDetailValue(details) };
  if (Array.isArray(raw.message)) return { errors: sanitizeDetailValue(raw.message) };
  return {};
}

export function normalizeApiErrorMessage(status: number, raw: unknown): string {
  if (status >= 500) {
    if (status === 503) return 'Service unavailable';
    return 'Internal server error';
  }
  if (isRecord(raw) && typeof raw.message === 'string' && raw.message.trim()) return raw.message;
  if (isRecord(raw) && Array.isArray(raw.message)) return 'Request validation failed';
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (status === 401) return 'Authentication required';
  if (status === 403) return 'Access denied';
  if (status === 404) return 'Resource not found';
  if (status === 409) return 'Resource conflict';
  if (status === 422 || status === 400) return 'Request validation failed';
  if (status === 429) return 'Rate limit exceeded';
  return status >= 500 ? 'Internal server error' : 'Request failed';
}
