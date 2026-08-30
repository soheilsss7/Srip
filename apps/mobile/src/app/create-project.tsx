import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const STATUS = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function CreateProject() {
  const { token, can } = useSession();
  const canCreate = can('project.write');
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [status, setStatus] = useState('PLANNED');
  const [priority, setPriority] = useState('MEDIUM');
  const [startAt, setStartAt] = useState('');
  const [targetAt, setTargetAt] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgLabel, setOrgLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create projects.'); return; }
    if (name.trim().length < 2) { setE('Name is required.'); return; }
    const startDate = startAt.trim() ? new Date(startAt) : null;
    const targetDate = targetAt.trim() ? new Date(targetAt) : null;
    if (startDate && Number.isNaN(startDate.getTime())) { setE('Start date is invalid.'); return; }
    if (targetDate && Number.isNaN(targetDate.getTime())) { setE('Target date is invalid.'); return; }
    if (startDate && targetDate && targetDate < startDate) { setE('Target date must be after the start date.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/projects', {
        name: name.trim(),
        description: description.trim() || undefined,
        objective: objective.trim() || undefined,
        status,
        priority,
        startAt: startDate?.toISOString(),
        targetAt: targetDate?.toISOString(),
        organizationId: orgId || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>New Project</Text><Text style={styles.error}>You do not have permission to create projects in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Project</Text>
        <TextInput style={styles.input} placeholder="Name (required)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Objective" value={objective} onChangeText={setObjective} multiline />
        <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" value={startAt} onChangeText={setStartAt} />
        <TextInput style={styles.input} placeholder="Target date (YYYY-MM-DD)" value={targetAt} onChangeText={setTargetAt} />
        <EntityPicker label="Organization (optional)" endpoint="/organizations" value={orgId} selectedLabel={orgLabel} onChange={(id, label) => { setOrgId(id); setOrgLabel(label ?? ''); }} disabled={saving} />
        <Text style={styles.label}>Status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {STATUS.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: status === s ? colors.accent : colors.card, borderWidth: 1, borderColor: status === s ? colors.accent : colors.border }}>
              <Text style={{ color: status === s ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Priority</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {PRIORITY.map((p) => (
            <Pressable key={p} onPress={() => setPriority(p)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: priority === p ? colors.accent : colors.card, borderWidth: 1, borderColor: priority === p ? colors.accent : colors.border }}>
              <Text style={{ color: priority === p ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{p}</Text>
            </Pressable>
          ))}
        </View>
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}