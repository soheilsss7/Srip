import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiPostOffline } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

const TYPES = ['HOLDING', 'SUBSIDIARY', 'CUSTOMER', 'PARTNER', 'BANK', 'GOVERNMENT', 'INVESTOR', 'SUPPLIER', 'OTHER'];

export default function CreateOrganization() {
  const { token, can } = useSession();
  const canCreate = can('org.write');
  const router = useRouter();
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState('OTHER');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [parentOrgId, setParentOrgId] = useState('');
  const [parentOrgLabel, setParentOrgLabel] = useState('');
  const [e, setE] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!canCreate) { setE('You do not have permission to create organizations.'); return; }
    if (name.trim().length < 2) { setE('Name is required (min 2 characters).'); return; }
    if (website.trim() && !/^https?:\/\//i.test(website.trim())) { setE('Website must start with http(s)://'); return; }
    setSaving(true); setE('');
    try {
      await apiPostOffline('/organizations', {
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        displayName: displayName.trim() || undefined,
        type,
        industry: industry.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        website: website.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        parentOrganizationId: parentOrgId.trim() || undefined,
      }, token);
      router.back();
    } catch (x) { setE((x as Error).message); setSaving(false); }
  }

  if (!canCreate) return <SafeAreaView style={styles.screen}><Text style={styles.title}>New Organization</Text><Text style={styles.error}>You do not have permission to create organizations in the current workspace.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>New Organization</Text>
        <TextInput style={styles.input} placeholder="Name (required)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Legal name" value={legalName} onChangeText={setLegalName} />
        <TextInput style={styles.input} placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
        <Text style={styles.label}>Type</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginRight: 6, marginBottom: 6, backgroundColor: type === t ? colors.accent : colors.card, borderWidth: 1, borderColor: type === t ? colors.accent : colors.border }}>
              <Text style={{ color: type === t ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Industry" value={industry} onChangeText={setIndustry} />
        <TextInput style={styles.input} placeholder="Country" value={country} onChangeText={setCountry} />
        <TextInput style={styles.input} placeholder="City" value={city} onChangeText={setCity} />
        <TextInput style={styles.input} placeholder="Address" value={address} onChangeText={setAddress} />
        <TextInput style={styles.input} placeholder="Website (https://…)" value={website} onChangeText={setWebsite} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <EntityPicker label="Parent organization (optional)" endpoint="/organizations" value={parentOrgId} selectedLabel={parentOrgLabel} onChange={(id, label) => { setParentOrgId(id); setParentOrgLabel(label ?? ''); }} disabled={saving} />
        {e ? <Text style={styles.error}>{e}</Text> : null}
        <Pressable style={styles.button} disabled={saving} onPress={save}><Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
