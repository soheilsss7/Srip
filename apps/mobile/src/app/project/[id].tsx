import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, apiPatch, apiPost, api } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';
import { EntityPicker } from '../../features/entity-picker';

const STATUS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const REQ_STATUS = ['OPEN', 'IN_PROGRESS', 'SATISFIED', 'BLOCKED', 'CANCELLED'];
const MILESTONE_STATUS = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED'];
const arr = (x: any) => Array.isArray(x) ? x : [];

export default function ProjectDetail() {
  const { token, can } = useSession();
  const canWrite = can('project.write');
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
  const [reqTitle, setReqTitle] = useState('');
  const [relId, setRelId] = useState('');
  const [relLabel, setRelLabel] = useState('');

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
    if (!canWrite) { setError('You have read-only access to this project.'); return; }
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  async function save() {
    await act('patch', () => apiPatch(`/projects/${id}`, { name: name.trim() || undefined, objective: objective.trim() || undefined, description: description.trim() || undefined }, token));
  }
  async function addRisk() {
    if (!riskTitle.trim()) { setError('Risk title required.'); return; }
    const probability = riskProb.trim() ? Number(riskProb) : 0;
    const impact = riskImpact.trim() ? Number(riskImpact) : 0;
    if (!Number.isInteger(probability) || probability < 0 || probability > 100 || !Number.isInteger(impact) || impact < 0 || impact > 100) { setError('Probability and impact must be whole numbers from 0 to 100.'); return; }
    await act('risk', () => apiPost(`/projects/${id}/risks`, { title: riskTitle.trim(), probability, impact }, token));
    setRiskTitle(''); setRiskProb(''); setRiskImpact('');
  }
  async function addMilestone() {
    if (!msTitle.trim()) { setError('Milestone title required.'); return; }
    const dueDate = msDue.trim() ? new Date(msDue) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) { setError('Milestone due date is invalid.'); return; }
    await act('milestone', () => apiPost(`/projects/${id}/milestones`, { title: msTitle.trim(), dueAt: dueDate?.toISOString() }, token));
    setMsTitle(''); setMsDue('');
  }
  async function addRequirement() {
    if (!reqTitle.trim()) { setError('Requirement title required.'); return; }
    await act('req', () => apiPost('/projects/requirements', { projectId: String(id), title: reqTitle.trim() }, token));
    setReqTitle('');
  }
  async function changeRiskStatus(r: any, status: string) { await act('rstat', () => apiPatch(`/projects/risks/${r.id}`, { status }, token)); }
  async function deleteRisk(r: any) {
    Alert.alert('حذف ریسک', `«${r.title}» حذف شود؟`, [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => act('rdel', () => api(`/projects/risks/${r.id}`, { method: 'DELETE' }, token)) }]);
  }
  async function changeMsStatus(m: any, status: string) { await act('mstat', () => apiPatch(`/projects/milestones/${m.id}`, { status }, token)); }
  async function deleteMs(m: any) {
    Alert.alert('حذف مایل‌استون', `«${m.title}» حذف شود؟`, [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => act('mdel', () => api(`/projects/milestones/${m.id}`, { method: 'DELETE' }, token)) }]);
  }
  async function changeReqStatus(rq: any, status: string) { await act('qstat', () => apiPatch(`/projects/requirements/${rq.id}`, { status }, token)); }
  async function deleteReq(rq: any) {
    Alert.alert('حذف نیازمندی', `«${rq.title}» حذف شود؟`, [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => act('qdel', () => api(`/projects/requirements/${rq.id}`, { method: 'DELETE' }, token)) }]);
  }
  async function linkRel() {
    if (!relId.trim()) { setError('Choose a relationship.'); return; }
    await act('link', () => apiPost(`/projects/${id}/relationships`, { relationshipId: relId.trim() }, token));
    setRelId('');
    setRelLabel('');
  }
  async function unlinkRel(rl: any) {
    Alert.alert('حذف پیوند', 'ارتباط از پروژه حذف شود؟', [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => act('unlink', () => api(`/projects/${id}/relationships/${rl.id ?? rl.relationshipId}`, { method: 'DELETE' }, token)) }]);
  }
  async function deleteProject() {
    Alert.alert('حذف پروژه', `«${p?.name}» حذف شود؟`, [{ text: 'لغو', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => { setBusy('pdel'); setError(null); try { await api(`/projects/${id}`, { method: 'DELETE' }, token); router.replace('/projects'); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); } } }]);
  }

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
            <Pressable style={[styles.button, { backgroundColor: colors.danger, marginTop: 8 }]} disabled={!!busy} onPress={deleteProject}><Text style={styles.buttonText}>{busy === 'pdel' ? 'Deleting…' : 'Delete project'}</Text></Pressable>
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
            <Text style={styles.label}>Linked relationships</Text>
            {arr(p.relationships).length === 0 ? <Text style={{ color: colors.muted }}>No linked relationships.</Text> : arr(p.relationships).map((r: any) => (
              <View key={r.id ?? r.relationshipId} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{r.relationshipType ?? r.relationship?.relationshipType ?? 'Relationship'}</Text>
                <Pressable onPress={() => unlinkRel(r)}><Text style={{ color: colors.danger, fontWeight: '700' }}>Unlink</Text></Pressable>
              </View>
            ))}
            <EntityPicker label="Add relationship" endpoint="/relationships" value={relId} selectedLabel={relLabel} onChange={(value, label) => { setRelId(value); setRelLabel(label ?? ''); }} disabled={!!busy} />
            <Pressable style={styles.button} disabled={!!busy || !relId} onPress={linkRel}><Text style={styles.buttonText}>Link</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Risks</Text>
            {arr(p.risks).length === 0 ? <Text style={{ color: colors.muted }}>No risks.</Text> : arr(p.risks).map((r: any) => (
              <View key={r.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{r.title} — {r.score ?? (r.probability * r.impact)}</Text>
                <Text style={styles.subtitle}>P{r.probability} × I{r.impact} · {r.status}</Text>
                <View style={styles.row}>
                  {['OPEN', 'MITIGATED', 'CLOSED'].map(s => chip(s, r.status === s, () => changeRiskStatus(r, s)))}
                  <Pressable onPress={() => deleteRisk(r)}><Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text></Pressable>
                </View>
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
                <View style={styles.row}>
                  {MILESTONE_STATUS.map(s => chip(s, m.status === s, () => changeMsStatus(m, s)))}
                  <Pressable onPress={() => deleteMs(m)}><Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Milestone title" value={msTitle} onChangeText={setMsTitle} />
            <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" value={msDue} onChangeText={setMsDue} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addMilestone}><Text style={styles.buttonText}>Add milestone</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Requirements</Text>
            {arr(p.requirements).length === 0 ? <Text style={{ color: colors.muted }}>No requirements.</Text> : arr(p.requirements).map((rq: any) => (
              <View key={rq.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{rq.title}</Text>
                <Text style={styles.subtitle}>{rq.status}{rq.priority ? ` · ${rq.priority}` : ''}</Text>
                <View style={styles.row}>
                  {REQ_STATUS.map(s => chip(s, rq.status === s, () => changeReqStatus(rq, s)))}
                  <Pressable onPress={() => deleteReq(rq)}><Text style={{ color: colors.danger, fontWeight: '700' }}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="New requirement title" value={reqTitle} onChangeText={setReqTitle} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addRequirement}><Text style={styles.buttonText}>Add requirement</Text></Pressable>
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
