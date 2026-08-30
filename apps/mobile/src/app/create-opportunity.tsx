import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const STATUS = ['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST'];

export default function CreateOpportunity() {
  const { token, can } = useSession();
  const canCreate = can('opportunity.write');
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('IDENTIFIED');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [orgId, setOrgId] = useState('');
  const [orgLabel, setOrgLabel] = useState('');
  const [relId, setRelId] = useState('');
  const [relLabel, setRelLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create opportunities.'); return; }
    if (name.trim().length < 2) { setE('Name is required.'); return; }
    const parsedValue = value.trim() ? Number(value) : null;
    const parsedProbability = probability.trim() ? Number(probability) : null;
    if (parsedValue !== null && !Number.isFinite(parsedValue)) { setE('Value must be a valid number.'); return; }
    if (parsedProbability !== null && (!Number.isInteger(parsedProbability) || parsedProbability < 0 || parsedProbability > 100)) { setE('Probability must be an integer between 0 and 100.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/opportunities', {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        value: parsedValue ?? undefined,
        probability: parsedProbability ?? undefined,
        organizationId: orgId || undefined,
        relationshipId: relId || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>New Opportunity</Text><Text style={styles.error}>You do not have permission to create opportunities in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Opportunity</Text>
        <TextInput style={styles.input} placeholder="Name (required)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Value (number)" value={value} onChangeText={setValue} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Probability %" value={probability} onChangeText={setProbability} keyboardType="numeric" />
        <EntityPicker label="Organization (optional)" endpoint="/organizations" value={orgId} selectedLabel={orgLabel} onChange={(id, label) => { setOrgId(id); setOrgLabel(label ?? ''); }} disabled={saving} />
        <EntityPicker label="Relationship (optional)" endpoint="/relationships" value={relId} selectedLabel={relLabel} onChange={(id, label) => { setRelId(id); setRelLabel(label ?? ''); }} disabled={saving} />
        <Text style={styles.label}>Status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {STATUS.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: status === s ? colors.accent : colors.card, borderWidth: 1, borderColor: status === s ? colors.accent : colors.border }}>
              <Text style={{ color: status === s ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}