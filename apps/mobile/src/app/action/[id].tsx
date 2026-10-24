import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, api } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const STATUS = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function ActionDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [a, setA] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [outcome, setOutcome] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [depIds, setDepIds] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const d = await apiGet<any>(`/actions/${id}`, token);
      setA(d); setTitle(d.title ?? ''); setOutcome(d.outcome ?? '');
      setDueAt(d.dueAt ? d.dueAt.slice(0, 10) : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  const body = (extra: Record<string, unknown> = {}) => ({
    title: title.trim() || a?.title,
    outcome: outcome.trim() || undefined,
    dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : undefined,
    ...extra,
  });
  async function save() {
    await act('patch', () => apiPatch(`/actions/${id}`, body(), token));
  }
  const setStatus = (s: string) => act('status', () => apiPatch(`/actions/${id}`, { title: title.trim() || a?.title, status: s }, token));
  const remove = async () => {
    await act('del', () => api(`/actions/${id}`, { method: 'DELETE' }, token));
  };
  const addDep = async () => {
    const depId = depIds.trim().split(/\s*,\s*/)[0];
    if (!depId) { setError('Dependency action ID required.'); return; }
    await act('dep', () => api(`/actions/${id}/dependencies/${depId}`, { method: 'POST' }, token));
    setDepIds('');
  };
  const arr = (x: any) => x ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{a?.title ?? 'Action'}</Text>
        {!!a && <Text style={styles.subtitle}>{a?.status} · {a?.priority}{a?.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString()}` : ''}{a?.owner?.name ? ` · ${a.owner.name}` : ''}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!a && !error && <ActivityIndicator />}

        {a && <>
          <View style={styles.card}>
            <Text style={styles.label}>Edit</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={dueAt} onChangeText={setDueAt} placeholder="Due date (YYYY-MM-DD)" />
            </View>
            <TextInput style={styles.input} value={outcome} onChangeText={setOutcome} placeholder="Outcome" multiline />
            <Pressable style={styles.button} disabled={!!busy} onPress={save}><Text style={styles.buttonText}>{busy === 'patch' ? 'Saving…' : 'Save'}</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STATUS.map(s => chip(s, a.status === s, () => setStatus(s)))}
            </View>
            <Text style={styles.label}>Priority</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {PRIORITY.map(p => chip(`${p}`, a.priority === p, () => act('priority', () => apiPatch(`/actions/${id}`, { title: title.trim() || a?.title, priority: p }, token))))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Owner', a.owner?.name], ['Created by', a.createdBy?.name], ['Organization', a.organization?.name], ['Project', a.project?.name], ['Person', a.person?.displayName ?? a.person?.firstName], ['Meeting', a.meeting?.title], ['Relationship', a.relationship?.relationshipType], ['Completion', a.completionAt ? new Date(a.completionAt).toLocaleDateString() : '']].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Depends on</Text>
            {arr(a.dependencies).length === 0 ? <Text style={{ color: colors.muted }}>No dependencies.</Text> : arr(a.dependencies).map((d: any) => (
              <View key={d.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.value}>{d.dependsOnAction?.title ?? d.dependsOnActionId}</Text>
                    <Text style={styles.subtitle}>{d.dependsOnAction?.status ?? ''}</Text>
                  </View>
                  <Pressable onPress={() => act('dep', () => api(`/actions/${id}/dependencies/${d.dependsOnActionId}`, { method: 'DELETE' }, token))}>
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Depends-on action ID" value={depIds} onChangeText={setDepIds} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addDep}><Text style={styles.buttonText}>Add dependency</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Blocking</Text>
            {arr(a.blockedBy).length === 0 ? <Text style={{ color: colors.muted }}>Nothing depends on this action.</Text> : arr(a.blockedBy).map((b: any) => (
              <View key={b.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{b.action?.title ?? b.actionId}</Text>
                <Text style={styles.subtitle}>{b.action?.status ?? ''}</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.button, { backgroundColor: '#c0392b' }]} disabled={!!busy} onPress={() => Alert.alert('Delete action', `Delete "${a.title}"?`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }])}>
            <Text style={styles.buttonText}>{busy === 'del' ? 'Deleting…' : 'Delete action'}</Text>
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