import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable } from 'react-native';
import { useSession } from '../state/session';
import { apiPostOffline } from '../services/api-client';
import { styles, colors } from '../lib/ui';

export default function AddNote() {
  const { token, can } = useSession();
  const canCreate = can('entity.write');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create notes.'); return; }
    if (!body.trim()) { setE('Note body is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/notes', { title: subject.trim() || undefined, body: body.trim() }, token);
      setSubject(''); setBody(''); setE('Saved.');
    } catch (x) { setE((x as Error).message); } finally { setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>Add Note</Text><Text style={styles.error}>You do not have permission to create notes in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Add Note</Text>
      <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject (optional)" />
      <TextInput style={styles.input} value={body} onChangeText={setBody} placeholder="Note" multiline />
      {e ? <Text style={e === 'Saved.' ? { color: colors.success, fontSize: 14 } : styles.error}>{e}</Text> : null}
      <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
    </SafeAreaView>
  );
}