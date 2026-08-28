import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

const STATUS = ['IDENTIFIED', 'QUALIFYING', 'ACTIVE', 'WON', 'LOST'];

export default function CreateOpportunity() {
  const { token } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('IDENTIFIED');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [orgId, setOrgId] = useState('');
  const [relId, setRelId] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (name.trim().length < 2) { setE('Name is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/opportunities', {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        value: value.trim() ? Number(value) : undefined,
        probability: probability.trim() ? Number(probability) : undefined,
        organizationId: orgId.trim() || undefined,
        relationshipId: relId.trim() || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Opportunity</Text>
        <TextInput style={styles.input} placeholder="Name (required)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Description" value={description} onChangeText={setDescription} multiline />
        <TextInput style={styles.input} placeholder="Value (number)" value={value} onChangeText={setValue} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Probability %" value={probability} onChangeText={setProbability} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Organization ID (optional)" value={orgId} onChangeText={setOrgId} />
        <TextInput style={styles.input} placeholder="Relationship ID (optional)" value={relId} onChangeText={setRelId} />
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