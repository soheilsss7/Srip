import {
  API_ERROR_CODES,
  normalizeApiErrorCode,
  normalizeApiErrorDetails,
  normalizeApiErrorMessage,
} from '../../src/common/api-contract/error-contract';

describe('PHASE AO error contract', () => {
  it('defines the complete stable backend error catalog', () => {
    expect(Object.values(API_ERROR_CODES)).toEqual([
      'AUTH_REQUIRED',
      'AUTH_INVALID',
      'ACCESS_DENIED',
      'ORG_SCOPE_DENIED',
      'FIELD_ACCESS_DENIED',
      'VALIDATION_ERROR',
      'RESOURCE_NOT_FOUND',
      'DUPLICATE_RESOURCE',
      'APPROVAL_REQUIRED',
      'RATE_LIMITED',
      'IDEMPOTENCY_CONFLICT',
      'INTEGRATION_ERROR',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ]);
  });

  it('normalizes legacy error codes into stable codes', () => {
    expect(normalizeApiErrorCode(401, { code: 'UNAUTHENTICATED', message: 'Authentication required' }, 'Authentication required')).toBe('AUTH_REQUIRED');
    expect(normalizeApiErrorCode(403, { code: 'FORBIDDEN', message: 'Access denied' }, 'Access denied')).toBe('ACCESS_DENIED');
    expect(normalizeApiErrorCode(404, { code: 'NOT_FOUND', message: 'Missing' }, 'Missing')).toBe('RESOURCE_NOT_FOUND');
    expect(normalizeApiErrorCode(409, { code: 'IDEMPOTENCY_KEY_REUSED', message: 'reused' }, 'reused')).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('always produces object details', () => {
    expect(normalizeApiErrorDetails({ message: ['a', 'b'] })).toEqual({ errors: ['a', 'b'] });
    expect(normalizeApiErrorDetails({ details: { field: 'email' } })).toEqual({ field: 'email' });
    expect(normalizeApiErrorDetails('x')).toEqual({});
  });

  it('uses stable operational codes for server failures', () => {
    expect(normalizeApiErrorCode(500, undefined, 'Unexpected failure')).toBe('INTERNAL_ERROR');
    expect(normalizeApiErrorCode(503, undefined, 'Dependency unavailable')).toBe('SERVICE_UNAVAILABLE');
  });

  it('uses stable validation/auth messages', () => {
    expect(normalizeApiErrorMessage(400, { message: ['invalid'] })).toBe('Request validation failed');
    expect(normalizeApiErrorMessage(401, undefined)).toBe('Authentication required');
  });
});
