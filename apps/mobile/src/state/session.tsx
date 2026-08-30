import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { apiGet, apiPost, apiRequest, ApiClientError, API_BASE_URL, setApiScope } from '../services/api-client';
import { clearStoredTokens, getStoredScope, getStoredTokens, setStoredScope, setStoredTokens } from '../services/auth-store';
import { flushMutations, QueuedMutation } from '../services/offline-queue';
import { configureNotificationHandler, registerForPushNotifications } from '../services/push';

type Me = { id: string; email: string; name: string; memberships?: any[]; permissions?: string[]; accessibleOrganizationIds?: string[] };
type SessionContextValue = {
  token: string | null;
  me: Me | null;
  loading: boolean;
  online: boolean;
  scopeId: string | null;
  setScopeId: (id: string | null) => Promise<void>;
  can: (permission: string) => boolean;
  signIn: (email: string, password: string, otp?: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncOffline: () => Promise<{ sent: number; remaining: number; failed: number }>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function sendQueued(token: string, m: QueuedMutation) {
  // Keep the header explicit for offline replay contracts; apiRequest also carries it
  // through its retry/refresh path so the key remains stable after a token rotation.
  const headers: Record<string, string> = {};
  if (m.idempotencyKey) headers['Idempotency-Key'] = m.idempotencyKey;
  await apiRequest(m.path, {
    method: m.method,
    headers,
    body: m.body === undefined ? undefined : JSON.stringify(m.body),
  }, token, m.idempotencyKey);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [scopeId, setScopeIdState] = useState<string | null>(null);

  useEffect(() => {
    configureNotificationHandler();
    (async () => {
      try {
        const [stored, storedScope] = await Promise.all([getStoredTokens(), getStoredScope()]);
            setScopeIdState(storedScope ?? 'all');
            setApiScope(storedScope ?? 'all');
            if (!stored?.accessToken) return;
        try {
          const profile = await apiGet<Me>('/auth/me', stored.accessToken);
          setMe(profile);
          setToken(stored.accessToken);
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 401) await clearStoredTokens();
          setMe(null);
          setToken(null);
        }
      } catch { /* no stored session */ }
      finally { setLoading(false); }
    })();
  }, []);

  const syncOffline = async () => {
    if (!token) return { sent: 0, remaining: 0, failed: 0 };
    return flushMutations((m) => sendQueued(token, m));
  };

  useEffect(() => {
    let alive = true;
    const checkConnectivity = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health/live`, { method: 'GET' });
        if (alive) setOnline(response.ok);
      } catch {
        if (alive) setOnline(false);
      }
    };
    void checkConnectivity();
    const timer = setInterval(() => { void checkConnectivity(); }, 30_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void checkConnectivity();
    });
    return () => { alive = false; clearInterval(timer); subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!token || !online) return;
    syncOffline().catch(() => {});
    registerForPushNotifications().catch(() => {});
  }, [token, online]);

  const value = useMemo<SessionContextValue>(() => ({
    token,
    me,
    loading,
    online,
    scopeId,
    can(permission) { return !!me?.permissions?.includes(permission) || !!me?.permissions?.includes('*'); },
        async setScopeId(id) {
          setScopeIdState(id);
          setApiScope(id ?? 'all');
          await setStoredScope(id ?? 'all');
        },
    async signIn(email, password, otp) {
      const result = await apiPost<{ accessToken?: string; token?: string; refreshToken?: string }>('/auth/login', {
        email,
        password,
        ...(otp?.trim() ? { otp: otp.trim() } : {}),
      });
      const next = result.accessToken ?? result.token;
      if (!next) throw new Error('Authentication response did not contain an access token');
      await setStoredTokens(next, result.refreshToken);
      try {
        const profile = await apiGet<Me>('/auth/me', next);
        setMe(profile);
        setToken(next);
      } catch (error) {
        await clearStoredTokens();
        setMe(null);
        throw error;
      }
    },
    async signOut() {
      if (token) {
        try {
          const stored = await getStoredTokens();
          if (stored?.refreshToken) await apiPost('/auth/logout', { token: stored.refreshToken }, token);
        } catch { /* best effort */ }
      }
      await clearStoredTokens();
          await setStoredScope('all');
          setApiScope('all');
          setScopeIdState('all');
      setMe(null);
      setToken(null);
    },
    syncOffline,
  }), [me, token, loading, online, scopeId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}