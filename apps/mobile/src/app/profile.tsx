import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { api, apiGet, apiPost } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Me = { id: string; email?: string; name?: string; memberships?: any[]; permissions?: string[]; accessibleOrganizationIds?: string[] };
type Session = { id: string; deviceName?: string | null; ipAddress?: string | null; userAgent?: string | null; lastActivityAt?: string | null; createdAt?: string; revokedAt?: string | null };

export default function Profile() {
  const { token } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setMe(await apiGet<Me>('/auth/me', token));
      const s = await apiGet<any>('/sessions', token);
      setSessions(Array.isArray(s) ? s : (s?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function revoke(id: string) {
    if (!token) return;
    setBusy(true);
    try { await api(`/sessions/${id}`, { method: 'DELETE' }, token); await load(); }
    catch (e) { Alert.alert('Revoke session', (e as Error).message); }
    finally { setBusy(false); }
  }
  async function revokeOthers() {
    if (!token) return;
    setBusy(true);
    try { await apiPost('/sessions/revoke-all-except-current', {}, token); await load(); }
    catch (e) { Alert.alert('Revoke others', (e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Profile</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {!me && !error && <ActivityIndicator />}
        {me && (
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text><Text style={styles.value}>{me.name ?? '—'}</Text>
            <Text style={styles.label}>Email</Text><Text style={styles.value}>{me.email ?? '—'}</Text>
            <Text style={styles.label}>Organizations</Text>
            <Text style={styles.value}>{(me.memberships ?? []).map((m) => m.organizationName ?? m.organizationId).join(', ') || '—'}</Text>
            <Text style={styles.label}>Permissions</Text>
            <Text style={styles.subtitle}>{(me.permissions ?? []).length} granted</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={[styles.button, { flex: 1 }]} disabled={busy} onPress={revokeOthers}><Text style={styles.buttonText}>Revoke other sessions</Text></Pressable>
        </View>
        <Text style={styles.subtitle}>Active sessions</Text>
        {sessions.map((s) => (
          <View key={s.id} style={styles.card}>
            <Text style={styles.value}>{s.deviceName ?? 'Device'}</Text>
            <Text style={styles.subtitle}>{s.ipAddress ?? ''} · {s.userAgent ?? ''}</Text>
            <Text style={styles.label}>Last activity: {s.lastActivityAt ? new Date(s.lastActivityAt).toLocaleString() : '—'}{s.revokedAt ? ' · revoked' : ''}</Text>
            {!s.revokedAt && <Pressable onPress={() => revoke(s.id)}><Text style={{ color: colors.danger, fontWeight: '700', marginTop: 6 }}>Revoke</Text></Pressable>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}