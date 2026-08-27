import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { TextStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPost, apiPatch } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

export default function RecommendationDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [r, setR] = useState<any>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [confidence, setConfidence] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [snoozeDays, setSnoozeDays] = useState('7');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/recommendations/${id}`, token);
      setR(d); setTitle(d.title ?? ''); setRationale(d.rationale ?? ''); setConfidence(d.confidence != null ? String(d.confidence) : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  async function save() {
    await act('patch', () => apiPatch(`/recommendations/${id}`, {
      title: title.trim() || undefined,
      rationale: rationale.trim() || undefined,
      confidence: confidence.trim() === '' ? undefined : Math.min(100, Math.max(0, Number(confidence))),
    }, token));
  }
  const showExplain = async () => { setError(null); setExplanation(null); try { setExplanation(await apiGet(`/recommendations/${id}/explain`, token)); } catch (e) { setError(e instanceof Error ? e.message : 'Explain failed'); } };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{r?.title ?? 'Recommendation'}</Text>
        {!!r && <Text style={styles.subtitle}>{r?.type} · {r?.status} · confidence {r?.confidence ?? 0}%</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!r && !error && <ActivityIndicator />}

        {r && <>
          <View style={styles.card}>
            <Text style={styles.label}>Rationale</Text>
            <Text style={styles.value}>{r.rationale}</Text>
            {r.evidence != null && typeof r.evidence === 'object' && Object.keys(r.evidence).length > 0 && (
              <Text style={{ color: colors.muted }}>{JSON.stringify(r.evidence)}</Text>
            )}
            {[['Relationship', r.relationship?.relationshipType], ['Source org', r.relationship?.sourceOrganization?.name], ['Target org', r.relationship?.targetOrganization?.name], ['Assigned to', r.assignedToId], ['Decided by', r.decisionById], ['Decision at', r.decisionAt ? new Date(r.decisionAt).toLocaleDateString() : ''], ['Snoozed until', r.snoozedUntil ? new Date(r.snoozedUntil).toLocaleDateString() : '']].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Edit</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />
            <TextInput style={styles.input} value={rationale} onChangeText={setRationale} placeholder="Rationale" multiline />
            <TextInput style={styles.input} value={confidence} onChangeText={setConfidence} placeholder="Confidence (0-100)" keyboardType="numeric" />
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Decide</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Pressable onPress={() => act('approve', () => apiPost(`/recommendations/${id}/approve`, {}, token))} style={actionChip('#027A48')}><Text style={chipText(true)}>{busy === 'approve' ? '…' : 'Approve'}</Text></Pressable>
              <Pressable onPress={() => act('reject', () => apiPost(`/recommendations/${id}/reject`, {}, token))} style={actionChip('#B42318')}><Text style={chipText(true)}>{busy === 'reject' ? '…' : 'Reject'}</Text></Pressable>
              <Pressable onPress={() => act('accept', () => apiPost(`/recommendations/${id}/accept`, {}, token))} style={actionChip('#7A5AF8')}><Text style={chipText(true)}>{busy === 'accept' ? '…' : 'Accept'}</Text></Pressable>
              <Pressable onPress={() => act('execute', () => apiPost(`/recommendations/${id}/execute`, {}, token))} style={actionChip('#2457D6')}><Text style={chipText(true)}>{busy === 'execute' ? '…' : 'Execute'}</Text></Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Snooze / Assign</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={snoozeDays} onChangeText={setSnoozeDays} placeholder="Days" keyboardType="numeric" />
              <Pressable style={styles.button} disabled={!!busy} onPress={() => act('snooze', () => apiPost(`/recommendations/${id}/snooze`, { until: new Date(Date.now() + (Math.max(1, Number(snoozeDays) || 7)) * 86400000).toISOString() }, token))}><Text style={styles.buttonText}>Snooze</Text></Pressable>
            </View>
            <TextInput style={styles.input} value={assigneeId} onChangeText={setAssigneeId} placeholder="Assignee user ID" />
            <Pressable style={styles.button} disabled={!!busy} onPress={() => act('assign', () => apiPost(`/recommendations/${id}/assign`, { assigneeId: assigneeId.trim() }, token))}><Text style={styles.buttonText}>Assign</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Explainability</Text>
            <Pressable style={styles.button} disabled={!!busy} onPress={showExplain}><Text style={styles.buttonText}>Explain</Text></Pressable>
            {explanation && <View style={{ marginTop: 8 }}>{typeof explanation === 'object' && 'explanation' in explanation ? <Text style={styles.value}>{String((explanation as any).explanation)}</Text> : <Text style={{ color: colors.muted }}>{typeof explanation === 'string' ? explanation : JSON.stringify(explanation).slice(0, 2500)}</Text>}</View>}
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
function actionChip(bg: string) {
  return { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: bg };
}
function chipText(white: boolean): TextStyle {
  return { color: '#fff', fontWeight: '700' as const, fontSize: 12 };
}