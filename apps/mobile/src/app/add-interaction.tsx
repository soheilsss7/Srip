import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useSession } from '../state/session';
import { apiPostOffline } from '../services/api-client';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'MESSAGE', 'OTHER'];
const IMPORTANCE = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function AddInteraction() {
  const { token, can } = useSession();
  const canCreate = can('interaction.write');
  const [type, setType] = useState('CALL');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [importance, setImportance] = useState('MEDIUM');
  const [relationshipId, setRelationshipId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create interactions.'); return; }
    if (!subject.trim()) { setE('Subject is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/interactions', {
        type, subject: subject.trim(), summary: summary.trim() || undefined,
        importance, relationshipId: relationshipId.trim() || undefined,
      }, token);
      setSubject(''); setSummary(''); setRelationshipId(''); setRelationshipLabel(''); setE('Saved.');
    } catch (x) { setE((x as Error).message); } finally { setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>Add Interaction</Text><Text style={styles.error}>You do not have permission to create interactions in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Add Interaction</Text>
        <Text style={styles.label}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {TYPES.map(t => chip(t, type === t, () => setType(t)))}
        </View>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="Subject" />
        <TextInput style={styles.input} value={summary} onChangeText={setSummary} placeholder="Summary" multiline />
        <Text style={styles.label}>Importance</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {IMPORTANCE.map(t => chip(t, importance === t, () => setImportance(t)))}
        </View>
        <EntityPicker label="Relationship (optional)" endpoint="/relationships" value={relationshipId} selectedLabel={relationshipLabel} onChange={(id, label) => { setRelationshipId(id); setRelationshipLabel(label ?? ''); }} disabled={saving} />
        {e ? <Text style={e === 'Saved.' ? { color: colors.success, fontSize: 14 } : styles.error}>{e}</Text> : null}
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