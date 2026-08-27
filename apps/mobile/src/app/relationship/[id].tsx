import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const LIFECYCLE = ['IDENTIFIED','INTRODUCED','INITIAL_CONTACT','DEVELOPING','ACTIVE','STRATEGIC','DORMANT','AT_RISK','LOST'];
const STATUS = ['PROSPECTIVE','ACTIVE','AT_RISK','DORMANT','ARCHIVED'];
const SCORES = ['healthScore','strategicScore','riskScore','trustScore','influenceScore','opportunityScore','resilienceScore','engagementScore'];

function chip(label: string, active: boolean, onPress: () => void) {
  return (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6,
        backgroundColor: active ? colors.accent : colors.card,
        borderWidth: 1, borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

export default function RelationshipDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const [rel, tl] = await Promise.all([apiGet<any>(`/relationships/${id}`, token), apiGet<any>(`/relationships/${id}/timeline`, token)]);
      setR(rel);
      setTimeline(Array.isArray(tl) ? tl : (tl?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function doAction(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }

  const title = r ? `${r.sourceOrganization?.name ?? ''} ↔ ${r.targetOrganization?.name ?? ''}`.replace(/^ ↔ | ↔ $/g, '') || 'Relationship' : 'Relationship';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{title}</Text>
        {!!r && <Text style={styles.subtitle}>{r.relationshipType ?? ''} · {r.status ?? ''}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!r && !error && <ActivityIndicator />}

        {r && <>
          <View style={styles.card}>
            <Text style={styles.label}>Scores</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SCORES.map(s => (
                <View key={s} style={{ minWidth: '30%', padding: 8, backgroundColor: colors.bg, borderRadius: 8 }}>
                  <Text style={styles.label}>{s.replace('Score','')}</Text>
                  <Text style={styles.value}>{r[s] ?? '—'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Ownership & Details</Text>
            {[['Owner', r.owner?.name], ['Backup Owner', r.backupOwner?.name], ['Lifecycle', r.lifecycleStage], ['Status', r.status], ['Relationship Type', r.relationshipType], ['Source Org', r.sourceOrganization?.name], ['Target Org', r.targetOrganization?.name]].filter(([, v]) => v != null).map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.map(s => chip(s, r.status === s, () => doAction('status', () => apiPatch(`/relationships/${id}`, { status: s }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Lifecycle stage</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {LIFECYCLE.map(s => chip(s, r.lifecycleStage === s, () => doAction('lifecycle', () => apiPatch(`/relationships/${id}/lifecycle`, { lifecycleStage: s }, token))))}
            </View>
          </View>

          <Pressable style={styles.button} disabled={!!busy} onPress={() => doAction('recalc', () => apiPost(`/relationships/${id}/recalculate-score`, {}, token))}>
            <Text style={styles.buttonText}>{busy === 'recalc' ? 'Recalculating…' : 'Recalculate score'}</Text>
          </Pressable>

          {r.status === 'ARCHIVED' ? (
            <Pressable style={styles.button} disabled={!!busy} onPress={() => doAction('restore', () => apiPost(`/relationships/${id}/restore`, {}, token))}>
              <Text style={styles.buttonText}>Restore</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.button, { backgroundColor: colors.danger }]} disabled={!!busy} onPress={() => doAction('archive', () => apiPatch(`/relationships/${id}/archive`, {}, token))}>
              <Text style={styles.buttonText}>Archive</Text>
            </Pressable>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Timeline</Text>
            {timeline.length === 0 ? <Text style={{ color: colors.muted }}>No timeline events.</Text> :
              timeline.map((item, i) => (
                <View key={item?.id ?? i} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Text style={styles.label}>{item?.kind ?? 'EVENT'}</Text>
                  <Text style={styles.value}>{item?.title ?? item?.subject ?? item?.description ?? item?.name ?? item?.status ?? '—'}</Text>
                  {item?.date ? <Text style={styles.subtitle}>{new Date(item.date).toLocaleString()}</Text> : null}
                </View>
              ))}
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
