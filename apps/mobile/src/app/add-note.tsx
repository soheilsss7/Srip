import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable } from 'react-native';
import { useSession } from '../state/session';
import { apiPostOffline } from '../services/api-client';
import { styles, colors } from '../lib/ui';

export default function AddNote() {
  const { token } = useSession();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim()) { setE('Note body is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/interactions', { type: 'NOTE', subject: subject.trim() || body.trim().slice(0, 60), summary: body.trim() }, token);
      setSubject(''); setBody(''); setE('Saved.');
    } catch (x) { setE((x as Error).message); } finally { setSaving(false); }
  }

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