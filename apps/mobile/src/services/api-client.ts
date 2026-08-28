import { enqueueMutation } from './offline-queue';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './auth-store';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokens.refreshToken }),
      });
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.accessToken) {
      await clearStoredTokens();
      return null;
    }
    await setStoredTokens(body.accessToken, body.refreshToken ?? tokens.refreshToken);
    return body.accessToken as string;
  })();
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body != null && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const next = await refreshAccessToken();
    if (next) {
      headers = new Headers(headers);
      headers.set('Authorization', `Bearer ${next}`);
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
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
  try {
    return await apiPost<T>(path, body, token);
  } catch (error) {
    if (isPermanentFailure(error)) throw error;
    await enqueueMutation({ path, method: 'POST', body });
    return { queued: true } as T;
  }
}

export async function apiPatchOffline<T>(path: string, body: unknown, token?: string | null) {
  try {
    return await apiPatch<T>(path, body, token);
  } catch (error) {
    if (isPermanentFailure(error)) throw error;
    await enqueueMutation({ path, method: 'PATCH', body });
    return { queued: true } as T;
  }
}