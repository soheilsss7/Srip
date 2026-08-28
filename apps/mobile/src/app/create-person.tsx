import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { apiGet, apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

const STATUS = ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'LEAD', 'CUSTOMER'];

type Org = { id: string; name?: string };
type Item = { id: string; name?: string };

export default function CreatePerson() {
  const { token } = useSession();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [orgId, setOrgId] = useState('');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  const loadOrgs = useCallback(async () => {
    if (!token) return;
    try {
      const x = await apiGet<any>('/organizations', token);
      const list: Item[] = Array.isArray(x) ? x : (x?.items ?? []);
      setOrgs(list.map((o) => ({ id: o.id, name: o.name ?? o.id })));
    } catch { /* org list is optional aid; user can type an id */ }
  }, [token]);
  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  async function save() {
    if (firstName.trim().length < 1) { setE('First name is required.'); return; }
    if (lastName.trim().length < 1) { setE('Last name is required.'); return; }
    if (!orgId.trim()) { setE('Organization is required.'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/people', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        organizationId: orgId.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        title: title.trim() || undefined,
        department: department.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Person</Text>
        <TextInput style={styles.input} placeholder="First name (required)" value={firstName} onChangeText={setFirstName} />
        <TextInput style={styles.input} placeholder="Last name (required)" value={lastName} onChangeText={setLastName} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="Department" value={department} onChangeText={setDepartment} />
        <TextInput style={styles.input} placeholder="Country" value={country} onChangeText={setCountry} />
        <TextInput style={styles.input} placeholder="Notes" value={notes} onChangeText={setNotes} multiline />
        <Text style={styles.label}>Status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {STATUS.map((s) => (
            <Pressable key={s} onPress={() => setStatus(s)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: status === s ? colors.accent : colors.card, borderWidth: 1, borderColor: status === s ? colors.accent : colors.border }}>
              <Text style={{ color: status === s ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Organization (required)</Text>
        {orgs.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {orgs.map((o) => (
              <Pressable key={o.id} onPress={() => setOrgId(o.id)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: orgId === o.id ? colors.accent : colors.card, borderWidth: 1, borderColor: orgId === o.id ? colors.accent : colors.border }}>
                <Text style={{ color: orgId === o.id ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{o.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : <ActivityIndicator />}
        <TextInput style={styles.input} placeholder="Organization ID (or pick above)" value={orgId} onChangeText={setOrgId} />
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
