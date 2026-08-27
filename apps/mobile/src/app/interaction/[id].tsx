import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPatch, api } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const IMPORTANCE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const KINDS = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'MESSAGE', 'OTHER'];
const SENTIMENTS = [{ v: 1, l: 'Positive' }, { v: 0, l: 'Neutral' }, { v: -1, l: 'Negative' }] as const;

export default function InteractionDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [x, setX] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [subject, setSubject] = useState('');
  const [followUp, setFollowUp] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/interactions/${id}`, token);
      setX(d); setSummary(d.summary ?? ''); setOutcome(d.outcome ?? ''); setSubject(d.subject ?? ''); setFollowUp(!!d.followUpRequired);
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
    await act('patch', () => apiPatch(`/interactions/${id}`, { subject: subject.trim(), summary: summary.trim() || undefined, outcome: outcome.trim() || undefined, followUpRequired: followUp }, token));
  }
  async function remove() {
    await act('del', () => api(`/interactions/${id}`, { method: 'DELETE' }, token));
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{x?.subject ?? 'Interaction'}</Text>
        {!!x && <Text style={styles.subtitle}>{x?.type ?? ''} · {x?.importance ?? ''} · followed up: {x?.followUpRequired ? 'yes' : 'no'}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!x && !error && <ActivityIndicator />}

        {x && <>
          <View style={styles.card}>
            <Text style={styles.label}>Summary</Text>
            <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" />
            <TextInput style={styles.input} value={summary} onChangeText={setSummary} placeholder="Summary" multiline />
            <TextInput style={styles.input} value={outcome} onChangeText={setOutcome} placeholder="Outcome" multiline />
            <View style={styles.row}>
              <Pressable onPress={() => setFollowUp(v => !v)}><Text style={{ color: followUp ? colors.success : colors.accent, fontWeight: '700' }}>{followUp ? '✓ Follow-up required' : 'Set follow-up required'}</Text></Pressable>
            </View>
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Importance</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {IMPORTANCE.map(s => chip(s, x.importance === s, () => act('importance', () => apiPatch(`/interactions/${id}`, { importance: s }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Sentiment</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {SENTIMENTS.map(s => chip(s.l, x.sentiment === s.v, () => act('sentiment', () => apiPatch(`/interactions/${id}`, { sentiment: s.v }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Type', x.type], ['Occurred', x.occurredAt ? new Date(x.occurredAt).toLocaleString() : ''], ['Duration (min)', x.durationMinutes], ['Relationship', x.relationshipId], ['Organization', x.organizationId], ['Person', x.personId]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.button, { backgroundColor: colors.danger }]} disabled={!!busy} onPress={remove}><Text style={styles.buttonText}>{busy === 'del' ? 'Deleting…' : 'Delete interaction'}</Text></Pressable>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
function chip(label: string, active: boolean, onPress: () => void) {
  return (
    <Pressable key={label} onPress={onPress} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: active ? colors.accent : colors.card, borderWidth: 1, borderColor: active ? colors.accent : colors.border }}>
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
