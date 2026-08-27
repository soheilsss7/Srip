import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const arr = (x: any) => Array.isArray(x) ? x : (x?.items ?? x?.data ?? x?.rows ?? []);

export default function OrganizationDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [o, setO] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [contactValue, setContactValue] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const [org, unitRows, tl, contactsRows] = await Promise.all([
        apiGet<any>(`/organizations/${id}`, token),
        apiGet<any>(`/core-domain/organizations/${id}/units`, token),
        apiGet<any>(`/organizations/${id}/timeline`, token),
        apiGet<any>(`/core-domain/organizations/${id}/contacts`, token),
      ]);
      setO(org); setUnits(arr(unitRows)); setTimeline(arr(tl)); setContacts(arr(contactsRows));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  async function addUnit() {
    if (!unitName.trim()) { setError('Unit name required.'); return; }
    await act('unit', () => apiPost(`/core-domain/organizations/${id}/units`, { name: unitName.trim() }, token));
    setUnitName('');
  }
  async function addContact() {
    if (!contactValue.trim()) { setError('Contact value required.'); return; }
    await act('contact', () => apiPost(`/core-domain/organizations/${id}/contacts`, { kind: 'PHONE', value: contactValue.trim() }, token));
    setContactValue('');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{o?.name ?? 'Organization'}</Text>
        {!!o && <Text style={styles.subtitle}>{o?.status ?? ''} · {o?.type ?? ''}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!o && !error && <ActivityIndicator />}

        {o && <>
          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['Country', o?.country], ['Status', o?.status], ['Type', o?.type], ['Strategic importance', o?.strategicImportance], ['Owner', o?.owner?.name]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Units ({units.length})</Text>
            {units.length === 0 ? <Text style={{ color: colors.muted }}>No units.</Text> : units.map((u) => (
              <View key={u.id} style={{ paddingVertical: 4 }}>
                <Text style={styles.value}>{u.name}</Text>
                <Text style={styles.label}>{u.type}</Text>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="New unit name" value={unitName} onChangeText={setUnitName} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addUnit}><Text style={styles.buttonText}>Add unit</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Contacts ({contacts.length})</Text>
            {contacts.length === 0 ? <Text style={{ color: colors.muted }}>No contacts.</Text> : contacts.map((c) => (
              <View key={c.id} style={{ paddingVertical: 4 }}>
                <Text style={styles.value}>{c.kind}: {c.value}</Text>
                {c.label ? <Text style={styles.label}>{c.label}</Text> : null}
              </View>
            ))}
            <TextInput style={styles.input} placeholder="New contact value" value={contactValue} onChangeText={setContactValue} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addContact}><Text style={styles.buttonText}>Add contact</Text></Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Timeline</Text>
            {timeline.length === 0 ? <Text style={{ color: colors.muted }}>No events.</Text> : timeline.slice(0, 40).map((x, i) => (
              <View key={x?.id ?? i} style={{ paddingVertical: 5, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={styles.label}>{x?.kind ?? x?.eventType ?? 'EVENT'}</Text>
                <Text style={styles.value}>{x?.title ?? x?.subject ?? x?.description ?? x?.name ?? '—'}</Text>
                {x?.date || x?.createdAt ? <Text style={styles.subtitle}>{new Date(x?.date ?? x?.createdAt).toLocaleString()}</Text> : null}
              </View>
            ))}
          </View>

          {o.deletedAt ? (
            <Pressable style={styles.button} disabled={!!busy} onPress={() => act('restore', () => apiPost(`/organizations/${id}/restore`, {}, token))}><Text style={styles.buttonText}>Restore</Text></Pressable>
          ) : (
            <Pressable style={[styles.button, { backgroundColor: colors.danger }]} disabled={!!busy} onPress={() => act('archive', () => apiPatch(`/organizations/${id}/archive`, {}, token))}><Text style={styles.buttonText}>Archive</Text></Pressable>
          )}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
