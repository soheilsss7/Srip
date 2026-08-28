import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Prefs = Record<string, boolean | string | null>;
type Log = { channel?: string; provider?: string; accepted?: boolean; errorMessage?: string | null; createdAt?: string; title?: string };

const TOGGLES: { key: string; label: string }[] = [
  { key: 'inAppEnabled', label: 'In-app notifications' },
  { key: 'emailEnabled', label: 'Email notifications' },
  { key: 'pushEnabled', label: 'Push notifications' },
  { key: 'digestEnabled', label: 'Digest enabled' },
  { key: 'criticalOnly', label: 'Critical only' },
  { key: 'dailyDigest', label: 'Daily digest' },
  { key: 'weeklyDigest', label: 'Weekly digest' },
];

export default function Settings() {
  const { token } = useSession();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setPrefs(await apiGet<Prefs>('/notifications/preferences', token));
      const l = await apiGet<any>('/notifications/delivery-log', token);
      setLog(Array.isArray(l) ? l : (l?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function toggle(key: string, value: boolean) {
    if (!token) return;
    setPrefs((p) => ({ ...(p ?? {}), [key]: value }));
    try { await apiPatch('/notifications/preferences', { [key]: value }, token); }
    catch (e) { setError((e as Error).message); load(); }
  }
  async function digest(cadence: 'DAILY' | 'WEEKLY') {
    if (!token) return;
    try { const r = await apiPost<any>(`/notifications/digest/${cadence}`, {}, token); Alert.alert('Digest', r?.sent ? 'Digest dispatched.' : r?.reason ?? 'Digest not sent.'); }
    catch (e) { Alert.alert('Digest', (e as Error).message); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Settings</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {!prefs && !error && <ActivityIndicator />}
        {prefs && (
          <View style={styles.card}>
            <Text style={styles.label}>Notification preferences</Text>
            {TOGGLES.map(({ key, label }) => (
              <Pressable key={key} onPress={() => toggle(key, !prefs[key])} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <Text style={styles.value}>{label}</Text>
                <Text style={{ color: prefs[key] ? colors.success : colors.muted, fontWeight: '700' }}>{prefs[key] ? 'On' : 'Off'}</Text>
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable style={[styles.button, { flex: 1 }]} onPress={() => digest('DAILY')}><Text style={styles.buttonText}>Send daily digest</Text></Pressable>
              <Pressable style={[styles.button, { flex: 1 }]} onPress={() => digest('WEEKLY')}><Text style={styles.buttonText}>Send weekly digest</Text></Pressable>
            </View>
          </View>
        )}
        <Text style={styles.subtitle}>Recent delivery log</Text>
        {log.map((l, i) => (
          <View key={`${l.createdAt}-${i}`} style={styles.card}>
            <Text style={styles.value}>{l.title ?? l.channel ?? 'Delivery'}</Text>
            <Text style={styles.subtitle}>{l.channel} · {l.provider} · {l.accepted ? 'accepted' : 'failed'}{l.errorMessage ? ` · ${l.errorMessage}` : ''}</Text>
          </View>
        ))}
        {!log.length && !error && <Text style={{ color: colors.muted }}>No deliveries yet.</Text>}
        <View style={styles.card}>
          <Text style={styles.label}>Security &amp; sync</Text>
          <Link href="/mfa" asChild><Pressable style={{ paddingVertical: 8 }}><Text style={styles.buttonText}>MFA &amp; two-factor →</Text></Pressable></Link>
          <Link href="/offline-queue" asChild><Pressable style={{ paddingVertical: 8 }}><Text style={styles.buttonText}>Offline queue →</Text></Pressable></Link>
          <Link href="/sync" asChild><Pressable style={{ paddingVertical: 8 }}><Text style={styles.buttonText}>Sync →</Text></Pressable></Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}