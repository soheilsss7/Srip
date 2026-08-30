import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function CreateAction() {
  const { token, can } = useSession();
  const canCreate = can('action.write');
  const router = useRouter();
  const [t, setT] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueAt, setDueAt] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgLabel, setOrgLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create actions.'); return; }
    if (!t.trim()) { setE('Action title is required.'); return; }
    const dueDate = dueAt.trim() ? new Date(dueAt) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) { setE('Due date is invalid.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/actions', {
        title: t.trim(),
        priority,
        dueAt: dueDate?.toISOString(),
        organizationId: orgId || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.title}>New Action</Text><Text style={styles.error}>You do not have permission to create actions in the current workspace.</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Action</Text>
        <TextInput style={styles.input} placeholder="Action title" value={t} onChangeText={setT} />
        <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" value={dueAt} onChangeText={setDueAt} />
        <EntityPicker label="Organization (optional)" endpoint="/organizations" value={orgId} selectedLabel={orgLabel} onChange={(id, label) => { setOrgId(id); setOrgLabel(label ?? ''); }} disabled={saving} />
        <Text style={styles.label}>Priority</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {PRIORITY.map(p => chip(p, priority === p, () => setPriority(p)))}
        </View>
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
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