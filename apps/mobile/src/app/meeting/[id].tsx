import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

export default function MeetingDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<any>(null);
  const [minutes, setMinutes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [transcript, setTranscript] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try { setM(await apiGet<any>(`/meetings/${id}`, token)); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function refreshMinutes() {
    if (!token) return;
    try { setMinutes(await apiGet<any>(`/meetings/${id}/minutes`, token)); } catch { setMinutes(null); }
  }
  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }

  async function submitOutcome() {
    await act('outcome', async () => {
      await apiPost(`/meetings/${id}/outcome`, { notes, outcome, decisions: [], transcript }, token);
      setNotes(''); setOutcome(''); setTranscript('');
      await Promise.all([load(), refreshMinutes()]);
    });
  }
  async function extract() {
    await act('extract', async () => {
      const x: any = await apiPost(`/meetings/${id}/action-items/extract`, {}, token);
      setCandidates(x?.candidates ?? []);
    });
  }
  async function applySelected() {
    const items = candidates.filter((_, i) => checked[i]).map((c: any) => ({ title: c.suggestedTitle, dueAt: c.suggestedDueAt, asCommitment: c.isCommitmentLike, priority: 'MEDIUM', description: c.text }));
    if (!items.length) return;
    await act('apply', async () => {
      await apiPost(`/meetings/${id}/action-items/apply`, { items }, token);
      setCandidates([]); setChecked({}); await refreshMinutes();
    });
  }
  async function finalize() {
    await act('finalize', async () => { await apiPost(`/meetings/${id}/finalize`, {}, token); await refreshMinutes(); });
  }
  async function setStatus(s: string) {
    await act('status', async () => { await apiPatch(`/meetings/${id}`, { status: s }, token); await load(); });
  }

  const participants = m?.participants ?? [];
  const actions = m?.actions ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{m?.title ?? 'Meeting'}</Text>
        {!!m && <Text style={styles.subtitle}>{m?.status ?? ''} · {new Date(m?.startAt ?? '').toLocaleDateString()} → {new Date(m?.endAt ?? '').toLocaleDateString()}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!m && !error && <ActivityIndicator />}

        {m && <>
          <View style={styles.card}>
            <Text style={styles.label}>Meeting info</Text>
            {[['Objective', m.objective], ['Agenda', m.agenda], ['Location', m.location], ['Status', m.status], ['Participants', participants.length], ['Related actions', actions.length]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {m.status !== 'COMPLETED' && chip('COMPLETE', m.status === 'COMPLETED', () => setStatus('COMPLETED'))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Record outcome</Text>
            <TextInput style={styles.input} placeholder="Outcome" value={outcome} onChangeText={setOutcome} multiline />
            <TextInput style={styles.input} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
            <TextInput style={styles.input} placeholder="Transcript (optional)" value={transcript} onChangeText={setTranscript} multiline />
            <Pressable style={styles.button} disabled={!!busy} onPress={submitOutcome}>
              <Text style={styles.buttonText}>{busy === 'outcome' ? 'Saving…' : 'Save outcome'}</Text>
            </Pressable>
            <Text style={styles.label}>Participants: {participants.map((p: any) => p?.person?.displayName ?? p?.person?.firstName ?? p?.personId ?? '').join(', ') || 'none'}</Text>
          </View>

          <Pressable style={styles.button} disabled={!!busy} onPress={() => { extract(); }}>
            <Text style={styles.buttonText}>{busy === 'extract' ? 'Extracting…' : 'Extract action items'}</Text>
          </Pressable>

          {candidates.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Suggested action items ({candidates.length}) — review and apply</Text>
              {candidates.map((c, i) => (
                <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Text style={styles.value}>{c.suggestedTitle}</Text>
                  <Text style={styles.subtitle}>{c.text} · due {new Date(c.suggestedDueAt ?? '').toLocaleDateString()} · {c.isCommitmentLike ? 'Commitment' : 'Action'}</Text>
                  <Pressable onPress={() => setChecked(x => ({ ...x, [i]: !x[i] }))}>
                    <Text style={{ color: checked[i] ? colors.success : colors.accent, fontWeight: '700' }}>{checked[i] ? '✓ Selected' : 'Select'}</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.button} disabled={!!busy || !Object.values(checked).some(Boolean)} onPress={applySelected}>
                <Text style={styles.buttonText}>Apply selected</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Minutes</Text>
              <Pressable onPress={refreshMinutes}><Text style={{ color: colors.accent, fontWeight: '700' }}>Refresh</Text></Pressable>
              <Pressable onPress={finalize}><Text style={{ color: colors.accent, fontWeight: '700' }}>Finalize</Text></Pressable>
            </View>
            {!minutes ? <Text style={{ color: colors.muted }}>Press Refresh to load minutes.</Text> : (
              <>
                <Text style={styles.value}>{minutes.outcome ?? '—'}</Text>
                {minutes.decisions?.length ? <Text style={styles.subtitle}>Decisions: {minutes.decisions.join('; ')}</Text> : null}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Open {minutes.actionItems?.open?.length ?? 0}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Overdue {minutes.actionItems?.overdueOpen?.length ?? 0}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Done {minutes.actionItems?.completed?.length ?? 0}</Text></View>
                </View>
                <Text style={styles.label}>Open commitments {minutes.commitments?.open?.length ?? 0} · fulfilled {minutes.commitments?.fulfilled?.length ?? 0}</Text>
              </>
            )}
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
function chip(label: string, active: boolean, onPress: () => void) {
  return (
    <Pressable key={label} onPress={onPress} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: active ? colors.accent : colors.card, borderWidth: 1, borderColor: active ? colors.accent : colors.border }}>
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
