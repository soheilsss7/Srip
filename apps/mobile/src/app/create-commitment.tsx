import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles } from '../lib/ui';

const STATUS = ['OPEN', 'FULFILLED', 'OVERDUE', 'CANCELLED'];

export default function CreateCommitment() {
  const { token } = useSession();
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [receiver, setReceiver] = useState('');
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [dueAt, setDueAt] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [orgId, setOrgId] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (description.trim().length < 2) { setE('Description is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/commitments', {
        description: description.trim(),
        source: source.trim() || undefined,
        receiver: receiver.trim() || undefined,
        risk: risk.trim() || undefined,
        status,
        dueAt: dueAt.trim() ? new Date(dueAt).toISOString() : undefined,
        reminderAt: reminderAt.trim() ? new Date(reminderAt).toISOString() : undefined,
        organizationId: orgId.trim() || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

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
        <TextInput style={styles.input} placeholder="Organization ID (optional)" value={orgId} onChangeText={setOrgId} />
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