import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { apiGet, apiPost } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

function MetricCard({ label, total, count }: { label: string; total: number; count: number }) {
  return (
    <View style={{ flex: 1, padding: 10, backgroundColor: colors.bg, borderRadius: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{count} / {total}</Text>
    </View>
  );
}

export default function DataQuality() {
  const { token } = useSession();
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try { setSnapshot(await apiGet<any>('/data/quality', token)); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  async function scan() {
    if (!token) return;
    setBusy(true); setError(null);
    try { const s = await apiPost<any>('/data/quality/scan', {}, token); setSnapshot(s); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(false); }
  }

  const m = snapshot?.metrics;
  const t = (x: any) => x?.total ?? 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Data Quality</Text>
        <Text style={styles.subtitle}>{snapshot ? `Scanned ${new Date(snapshot?.metrics?.generatedAt ?? snapshot?.scannedAt ?? Date.now()).toLocaleString()}` : 'Quality metrics for your scope.'}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={scan} disabled={busy}><Text style={styles.buttonText}>{busy ? 'Scanning…' : 'Run quality scan'}</Text></Pressable>
        {!snapshot && !error && <ActivityIndicator />}

        {snapshot && m && <>
          <View style={styles.card}>
            <Text style={styles.label}>Coverage</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <MetricCard label="Orgs" total={m.coverage?.organizations ?? 0} count={m.coverage?.organizations ?? 0} />
              <MetricCard label="People" total={m.coverage?.people ?? 0} count={m.coverage?.people ?? 0} />
              <MetricCard label="Relationships" total={m.coverage?.relationships ?? 0} count={m.coverage?.relationships ?? 0} />
              <MetricCard label="Interactions" total={m.coverage?.interactions ?? 0} count={m.coverage?.interactions ?? 0} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Duplicate organizations</Text>
            {!m.duplicateOrganizations?.length ? <Text style={{ color: colors.muted }}>None found.</Text> : m.duplicateOrganizations.map((d: any, i: number) => (
              <View key={i} style={{ paddingVertical: 4, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={styles.value}>Duplicate group {i + 1}</Text>
                <Text style={styles.subtitle}>{d.ids?.length ?? 0} records · Reasons: {d.reasons.join(', ')}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Issues</Text>
            <Text style={styles.value}>Missing owners: {t(m.missingOwners)}</Text>
            <Text style={styles.value}>Missing org contacts: {t(m.missingContacts?.organizations)} · missing person contacts: {t(m.missingContacts?.people)}</Text>
            <Text style={styles.value}>Stale relationships: {t(m.staleRelationships)}</Text>
            <Text style={styles.value}>Invalid emails: {t(m.invalidEmails)}</Text>
            <Text style={styles.value}>Missing review dates: {t(m.missingDates?.relationships)}</Text>
            <Text style={styles.value}>Incomplete orgs: {t(m.incompleteProfiles?.organizations)} · incomplete people: {t(m.incompleteProfiles?.people)}</Text>
          </View>

          {m.invalidEmails?.values?.length ? (
            <View style={styles.card}>
              <Text style={styles.label}>Invalid emails</Text>
              {m.invalidEmails.values.map((e: any, i: number) => (
                <Text key={i} style={styles.subtitle}>{e.entityType} {e.id} — {e.field}</Text>
              ))}
            </View>
          ) : null}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
