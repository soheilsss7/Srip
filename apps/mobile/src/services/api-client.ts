import { Platform } from 'react-native';
import { enqueueMutation } from './offline-queue';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './auth-store';
// Browser builds stay same-origin so they never try to call the user's localhost.
// Native builds must set EXPO_PUBLIC_API_URL to the reachable API origin.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'web' ? '/api/v1' : 'http://localhost:4000/api/v1');

export class ApiClientError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.body = body;
  }
}

let refreshPromise: Promise<string | null> | null = null;
let activeScopeId = 'all';
let keyCounter = 0;

export function setApiScope(scopeId: string | null) {
  activeScopeId = scopeId?.trim() || 'all';
}

function scopedPath(path: string, method: string): string {
  if (method !== 'GET' || activeScopeId === 'all' || /[?&]organizationId=/.test(path) || path.startsWith('/auth/') || path.startsWith('/health')) return path;
  return `${path}${path.includes('?') ? '&' : '?'}organizationId=${encodeURIComponent(activeScopeId)}`;
}

function makeIdempotencyKey(existing?: string | null): string {
  if (existing && existing.trim().length >= 16) return existing.trim();
  // 32-char hex, satisfies the backend's min-length (>=16) requirement.
  const rand = (globalThis.crypto?.randomUUID?.().replace(/-/g, '') ?? '');
  keyCounter = (keyCounter + 1) >>> 0;
  return (rand || `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`)
    .slice(0, 24) + keyCounter.toString(16).padStart(8, '0');
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokens.refreshToken }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.accessToken) {
        await clearStoredTokens();
        return null;
      }
      await setStoredTokens(body.accessToken, body.refreshToken ?? tokens.refreshToken);
      return body.accessToken as string;
    } catch {
      return null;
    } finally {
      // Keep the lock until SecureStore has been updated. Otherwise concurrent 401s
      // can rotate the same refresh token twice and trigger reuse detection.
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null, idempotencyKey?: string | null): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body != null && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = String(options.method ?? 'GET').toUpperCase();
  // Every protected write mutation must carry a valid Idempotency-Key (backend-enforced).
  // Auto-generate one when the caller (or offline queue) did not supply one. Reads (GET/HEAD)
  // never receive a key.
  if (MUTATING_METHODS.has(method) && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', makeIdempotencyKey(idempotencyKey));
  }
  const requestPath = scopedPath(path, method);
  let response = await fetch(`${API_BASE_URL}${requestPath}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const next = await refreshAccessToken();
    if (next) {
      headers = new Headers(headers);
      headers.set('Authorization', `Bearer ${next}`);
      response = await fetch(`${API_BASE_URL}${requestPath}`, { ...options, headers });
    }
  }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) await clearStoredTokens();
    let message = `API request failed: ${response.status}`;
    let body: unknown = null;
    try { const parsed = await response.json(); body = parsed; message = parsed?.message ?? message; } catch { /* keep fallback */ }
    throw new ApiClientError(message, response.status, body);
  }
  return response.status === 204 ? (undefined as T) : (await response.json()) as T;
}

export const apiGet = <T>(path: string, token?: string | null) => apiRequest<T>(path, {}, token);
export const apiPost = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, token);
export const apiPatch = <T>(path: string, body: unknown, token?: string | null) =>
  apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token);
export const api = <T>(path: string, options: RequestInit = {}, token?: string | null) =>
  apiRequest<T>(path, options, token);

function isPermanentFailure(error: unknown): boolean {
  return error instanceof ApiClientError && typeof error.status === 'number' && error.status >= 400 && error.status < 500;
}

export async function apiPostOffline<T>(path: string, body: unknown, token?: string | null) {
  // Stable key: used for the immediate attempt AND persisted to the queue so later
  // retries/reconnects replay the same mutation instead of creating duplicates.
  const idempotencyKey = makeIdempotencyKey();
  try {
    return await apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, token, idempotencyKey);
  } catch (error) {
    if (isPermanentFailure(error)) throw error;
    await enqueueMutation({ path, method: 'POST', body, idempotencyKey });
    return { queued: true } as T;
  }
}

export async function apiPatchOffline<T>(path: string, body: unknown, token?: string | null) {
  const idempotencyKey = makeIdempotencyKey();
  try {
    return await apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token, idempotencyKey);
  } catch (error) {
    if (isPermanentFailure(error)) throw error;
    await enqueueMutation({ path, method: 'PATCH', body, idempotencyKey });
    return { queued: true } as T;
  }
}