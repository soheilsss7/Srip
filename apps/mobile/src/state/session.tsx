import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, ApiClientError, API_BASE_URL } from '../services/api-client';
import { clearStoredTokens, getStoredTokens, setStoredScope, setStoredTokens } from '../services/auth-store';
import { flushMutations, QueuedMutation } from '../services/offline-queue';
import { configureNotificationHandler, registerForPushNotifications } from '../services/push';

type SessionContextValue = {
  token: string | null;
  loading: boolean;
  online: boolean;
  scopeId: string | null;
  setScopeId: (id: string | null) => Promise<void>;
  signIn: (email: string, password: string, otp?: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncOffline: () => Promise<{ sent: number; remaining: number; failed: number }>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function bearer(status: number, message: string) {
  const err = new ApiClientError(message, status);
  return err;
}

async function sendQueued(token: string, m: QueuedMutation) {
  const response = await fetch(`${API_BASE_URL}${m.path}`, {
    method: m.method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: m.body === undefined ? undefined : JSON.stringify(m.body),
  });
  if (!response.ok) throw bearer(response.status, `queued mutation failed ${response.status}`);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [scopeId, setScopeIdState] = useState<string | null>(null);

  useEffect(() => {
    configureNotificationHandler();
    (async () => {
      try {
        const stored = await getStoredTokens();
        setToken(stored?.accessToken ?? null);
      } catch { /* no stored session */ }
      finally { setLoading(false); }
    })();
  }, []);

  const syncOffline = async () => {
    if (!token) return { sent: 0, remaining: 0, failed: 0 };
    return flushMutations((m) => sendQueued(token, m));
  };

  useEffect(() => {
    if (!token) return;
    syncOffline().catch(() => {});
    registerForPushNotifications().catch(() => {});
  }, [token]);

  const value = useMemo<SessionContextValue>(() => ({
    token,
    loading,
    online,
    scopeId,
    async setScopeId(id) {
      setScopeIdState(id);
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
      setToken(next);
    },
    async signOut() {
      if (token) {
        try {
          const stored = await getStoredTokens();
          if (stored?.refreshToken) await apiPost('/auth/logout', { token: stored.refreshToken }, token);
        } catch { /* best effort */ }
      }
      await clearStoredTokens();
      setScopeIdState(null);
      setToken(null);
    },
    syncOffline,
  }), [token, loading, online, scopeId]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}