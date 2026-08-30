import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const STATUS = ['OPEN', 'FULFILLED', 'OVERDUE', 'CANCELLED'];

export default function CreateCommitment() {
  const { token, can } = useSession();
  const canCreate = can('commitment.write');
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [receiver, setReceiver] = useState('');
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [dueAt, setDueAt] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgLabel, setOrgLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create commitments.'); return; }
    if (description.trim().length < 2) { setE('Description is required.'); return; }
    const dueDate = dueAt.trim() ? new Date(dueAt) : null;
    const reminderDate = reminderAt.trim() ? new Date(reminderAt) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) { setE('Due date is invalid.'); return; }
    if (reminderDate && Number.isNaN(reminderDate.getTime())) { setE('Reminder date is invalid.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/commitments', {
        description: description.trim(),
        source: source.trim() || undefined,
        receiver: receiver.trim() || undefined,
        risk: risk.trim() || undefined,
        status,
        dueAt: dueDate?.toISOString(),
        reminderAt: reminderDate?.toISOString(),
        organizationId: orgId || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>New Commitment</Text><Text style={styles.error}>You do not have permission to create commitments in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Commitment</Text>
        <TextInput style={styles.input} placeholder="Description (required)" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Source" value={source} onChangeText={setSource} />
        <TextInput style={styles.input} placeholder="Receiver" value={receiver} onChangeText={setReceiver} />
        <TextInput style={styles.input} placeholder="Risk" value={risk} onChangeText={setRisk} />
        <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" value={dueAt} onChangeText={setDueAt} />
        <TextInput style={styles.input} placeholder="Reminder (YYYY-MM-DD)" value={reminderAt} onChangeText={setReminderAt} />
        <EntityPicker label="Organization (optional)" endpoint="/organizations" value={orgId} selectedLabel={orgLabel} onChange={(id, label) => { setOrgId(id); setOrgLabel(label ?? ''); }} disabled={saving} />
        <Text style={styles.label}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, backgroundColor: status === s ? '#2457D6' : '#fff', borderWidth: 1, borderColor: status === s ? '#2457D6' : '#E4E7EC' }}>
              <Text style={{ color: status === s ? '#fff' : '#17202A', fontWeight: '600', fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}