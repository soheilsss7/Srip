import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost, api } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const STATUS = ['OPEN', 'FULFILLED', 'OVERDUE', 'CANCELLED'];

export default function CommitmentDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [description, setDescription] = useState('');
  const [risk, setRisk] = useState('');
  const [source, setSource] = useState('');
  const [receiver, setReceiver] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reminderAt, setReminderAt] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/commitments/${id}`, token);
      setC(d); setDescription(d.description ?? ''); setRisk(d.risk ?? ''); setSource(d.source ?? '');
      setReceiver(d.receiver ?? ''); setDueAt(d.dueAt ? d.dueAt.slice(0, 10) : ''); setReminderAt(d.reminderAt ? d.reminderAt.slice(0, 10) : '');
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
    await act('patch', () => apiPatch(`/commitments/${id}`, {
      description: description.trim() || undefined,
      risk: risk.trim() || undefined,
      source: source.trim() || undefined,
      receiver: receiver.trim() || undefined,
      dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : undefined,
      reminderAt: reminderAt.trim() ? new Date(reminderAt).toISOString() : undefined,
    }, token));
  }
  const remove = async () => {
    await act('del', () => api(`/commitments/${id}`, { method: 'DELETE' }, token));
  };
  const personName = (p: any) => p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name : undefined;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{c?.description ?? 'Commitment'}</Text>
        {!!c && <Text style={styles.subtitle}>{c?.status}{c?.dueAt ? ` · due ${new Date(c.dueAt).toLocaleDateString()}` : ''}{c?.risk ? ` · ${c.risk}` : ''}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!c && !error && <ActivityIndicator />}

        {c && <>
          <View style={styles.card}>
            <Text style={styles.label}>Edit</Text>
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" multiline />
            <TextInput style={styles.input} value={risk} onChangeText={setRisk} placeholder="Risk" multiline />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={source} onChangeText={setSource} placeholder="Source" />
              <TextInput style={[styles.input, { flex: 1 }]} value={receiver} onChangeText={setReceiver} placeholder="Receiver" />
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={dueAt} onChangeText={setDueAt} placeholder="Due date (YYYY-MM-DD)" />
              <TextInput style={[styles.input, { flex: 1 }]} value={reminderAt} onChangeText={setReminderAt} placeholder="Reminder (YYYY-MM-DD)" />
            </View>
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.map(s => chip(s, c.status === s, () => act('status', () => apiPatch(`/commitments/${id}`, { status: s }, token))))}
            </View>
            {c.status !== 'FULFILLED' && (
              <Pressable style={[styles.button, { backgroundColor: '#c0392b' }]} disabled={!!busy} onPress={() => act('overdue', () => apiPost(`/commitments/${id}/mark-overdue`, {}, token))}>
                <Text style={styles.buttonText}>{busy === 'overdue' ? 'Marking…' : 'Mark overdue'}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Owner', c.owner?.name], ['Organization', c.organization?.name], ['Project', c.project?.name], ['Person', personName(c.person)], ['Meeting', c.meeting?.title], ['Relationship', c.relationship?.relationshipType]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.button, { backgroundColor: '#c0392b' }]} disabled={!!busy} onPress={remove}>
            <Text style={styles.buttonText}>{busy === 'del' ? 'Deleting…' : 'Delete commitment'}</Text>
          </Pressable>
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