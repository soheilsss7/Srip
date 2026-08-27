import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const STATUS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function ProjectDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [riskTitle, setRiskTitle] = useState('');
  const [riskProb, setRiskProb] = useState('');
  const [riskImpact, setRiskImpact] = useState('');
  const [msTitle, setMsTitle] = useState('');
  const [msDue, setMsDue] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/projects/${id}`, token);
      setP(d); setName(d.name ?? ''); setObjective(d.objective ?? ''); setDescription(d.description ?? '');
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
    await act('patch', () => apiPatch(`/projects/${id}`, { name: name.trim() || undefined, objective: objective.trim() || undefined, description: description.trim() || undefined }, token));
  }
  async function addRisk() {
    if (!riskTitle.trim()) { setError('Risk title required.'); return; }
    await act('risk', () => apiPost(`/projects/${id}/risks`, { title: riskTitle.trim(), probability: Number(riskProb) || 0, impact: Number(riskImpact) || 0 }, token));
    setRiskTitle(''); setRiskProb(''); setRiskImpact('');
  }
  async function addMilestone() {
    if (!msTitle.trim()) { setError('Milestone title required.'); return; }
    await act('milestone', () => apiPost(`/projects/${id}/milestones`, { title: msTitle.trim(), dueAt: msDue ? new Date(msDue).toISOString() : undefined }, token));
    setMsTitle(''); setMsDue('');
  }
  const arr = (x: any) => x ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{p?.name ?? 'Project'}</Text>
        {!!p && <Text style={styles.subtitle}>{p?.status} · {p?.priority}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!p && !error && <ActivityIndicator />}

        {p && <>
          <View style={styles.card}>
            <Text style={styles.label}>Edit</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
            <TextInput style={styles.input} value={objective} onChangeText={setObjective} placeholder="Objective" multiline />
            <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Description" multiline />
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.map(s => chip(s, p.status === s, () => act('status', () => apiPatch(`/projects/${id}`, { status: s }, token))))}
            </View>
            <Text style={styles.label}>Priority</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {PRIORITY.map(s => chip(s, p.priority === s, () => act('priority', () => apiPatch(`/projects/${id}`, { priority: s }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Start', p.startAt ? new Date(p.startAt).toLocaleDateString() : ''], ['Target', p.targetAt ? new Date(p.targetAt).toLocaleDateString() : ''], ['Organization', p.organization?.name], ['Owner', p.owner?.name], ['Requirements', arr(p.requirements).length], ['Risks', arr(p.risks).length], ['Milestones', arr(p.milestones).length], ['Linked relationships', arr(p.relationships).length]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Risks</Text>
            {arr(p.risks).length === 0 ? <Text style={{ color: colors.muted }}>No risks.</Text> : arr(p.risks).map((r: any) => (
              <View key={r.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{r.title} — {r.score ?? (r.probability * r.impact)}</Text>
                <Text style={styles.subtitle}>P{r.probability} × I{r.impact} · {r.status}</Text>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Risk title" value={riskTitle} onChangeText={setRiskTitle} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Prob" value={riskProb} onChangeText={setRiskProb} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Impact" value={riskImpact} onChangeText={setRiskImpact} keyboardType="numeric" />
            </View>
            <Pressable style={styles.button} disabled={!!busy} onPress={addRisk}><Text style={styles.buttonText}>Add risk</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Milestones</Text>
            {arr(p.milestones).length === 0 ? <Text style={{ color: colors.muted }}>No milestones.</Text> : arr(p.milestones).map((m: any) => (
              <View key={m.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{m.title}</Text>
                <Text style={styles.subtitle}>{m.status}{m.dueAt ? ` · due ${new Date(m.dueAt).toLocaleDateString()}` : ''}</Text>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Milestone title" value={msTitle} onChangeText={setMsTitle} />
            <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" value={msDue} onChangeText={setMsDue} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addMilestone}><Text style={styles.buttonText}>Add milestone</Text></Pressable>
          </View>
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
