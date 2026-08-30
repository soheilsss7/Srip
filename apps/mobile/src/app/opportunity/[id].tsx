import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, api } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const STATUS = ['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST'];

export default function OpportunityDetail() {
  const { token, can } = useSession();
  const canWrite = can('opportunity.write');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [o, setO] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/opportunities/${id}`, token);
      setO(d); setName(d.name ?? ''); setDescription(d.description ?? '');
      setValue(d.value != null ? String(d.value) : ''); setProbability(d.probability != null ? String(d.probability) : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    if (!canWrite) { setError('You have read-only access to this opportunity.'); return; }
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  async function save() {
    await act('patch', () => apiPatch(`/opportunities/${id}`, {
      name: name.trim() || undefined,
      description: description.trim() || undefined,
      value: value.trim() === '' ? undefined : Number(value),
      probability: probability.trim() === '' ? undefined : Math.min(100, Math.max(0, Number(probability))),
    }, token));
  }
  const remove = async () => {
    await act('del', () => api(`/opportunities/${id}`, { method: 'DELETE' }, token));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{o?.name ?? 'Opportunity'}</Text>
        {!!o && <Text style={styles.subtitle}>{o?.status} · {o?.probability != null ? `${o.probability}%` : '—'} · ${o?.value ?? 0}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!o && !error && <ActivityIndicator />}

        {o && <>
          <View style={styles.card}>
            <Text style={styles.label}>Edit</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" multiline />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={value} onChangeText={setValue} placeholder="Value" keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} value={probability} onChangeText={setProbability} placeholder="Probability %" keyboardType="numeric" />
            </View>
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.map(s => chip(s, o.status === s, () => act('status', () => apiPatch(`/opportunities/${id}`, { status: s }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Organization', o.organization?.name], ['Project', o.project?.name], ['Relationship', o.relationship?.subject]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.button, { backgroundColor: '#c0392b' }]} disabled={!!busy} onPress={remove}>
            <Text style={styles.buttonText}>{busy === 'del' ? 'Deleting…' : 'Delete opportunity'}</Text>
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
