import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet, apiPatch, apiPost } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

const arr = (x: any) => Array.isArray(x) ? x : (x?.items ?? x?.data ?? x?.rows ?? []);

export default function PersonDetail() {
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [contactValue, setContactValue] = useState('');
  const [orgId, setOrgId] = useState('');
  const [roleTitle, setRoleTitle] = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    try {
      const [person, cRows, orgRows, tl] = await Promise.all([
        apiGet<any>(`/people/${id}`, token),
        apiGet<any>(`/core-domain/people/${id}/contacts`, token),
        apiGet<any>(`/people/${id}/organizations`, token),
        apiGet<any>(`/people/${id}/timeline`, token),
      ]);
      setP(person); setContacts(arr(cRows)); setOrgs(arr(orgRows)); setTimeline(arr(tl));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token, id]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function act(label: string, fn: () => Promise<unknown>) {
    if (!token) return;
    setBusy(label); setError(null);
    try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); } finally { setBusy(''); }
  }
  async function addContact() {
    if (!contactValue.trim()) { setError('Contact value required.'); return; }
    await act('contact', () => apiPost(`/core-domain/people/${id}/contacts`, { kind: 'EMAIL', value: contactValue.trim() }, token));
    setContactValue('');
  }
  async function addOrg() {
    if (!orgId.trim()) { setError('Organization ID required.'); return; }
    await act('org', () => apiPost(`/people/${id}/organizations`, { organizationId: orgId.trim(), roleTitle: roleTitle.trim() || undefined }, token));
    setOrgId(''); setRoleTitle('');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>{p?.displayName ?? p?.firstName ?? 'Person'}</Text>
        {!!p && <Text style={styles.subtitle}>{p?.title ?? ''} · {p?.organization?.name ?? ''}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!p && !error && <ActivityIndicator />}

        {p && <>
          <View style={styles.card}>
            <Text style={styles.label}>Details</Text>
            {[['First name', p?.firstName], ['Last name', p?.lastName], ['Title', p?.title], ['Influence', p?.influenceScore], ['Status', p?.status]].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
              <View key={String(k)} style={{ paddingVertical: 3 }}>
                <Text style={styles.label}>{String(k)}</Text>
                <Text style={styles.value}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Org assignments ({orgs.length})</Text>
            {orgs.length === 0 ? <Text style={{ color: colors.muted }}>No assignments.</Text> : orgs.map((o) => (
              <View key={o?.id ?? o?.organizationId} style={{ paddingVertical: 4 }}>
                <Text style={styles.value}>{o?.organization?.name ?? o?.organizationId}</Text>
                <Text style={styles.label}>{o?.roleTitle ?? o?.role ?? '—'}</Text>
              </View>
            ))}
            <TextInput style={styles.input} placeholder="Organization ID" value={orgId} onChangeText={setOrgId} />
            <TextInput style={styles.input} placeholder="Role title (optional)" value={roleTitle} onChangeText={setRoleTitle} />
            <Pressable style={styles.button} disabled={!!busy} onPress={addOrg}><Text style={styles.buttonText}>Add assignment</Text></Pressable>
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
                <Text style={styles.label}>{x?.kind ?? 'EVENT'}</Text>
                <Text style={styles.value}>{x?.title ?? x?.subject ?? x?.description ?? x?.name ?? '—'}</Text>
                {x?.date || x?.createdAt ? <Text style={styles.subtitle}>{new Date(x?.date ?? x?.createdAt).toLocaleString()}</Text> : null}
              </View>
            ))}
          </View>

          {p.deletedAt ? (
            <Pressable style={styles.button} disabled={!!busy} onPress={() => act('restore', () => apiPost(`/people/${id}/restore`, {}, token))}><Text style={styles.buttonText}>Restore</Text></Pressable>
          ) : (
            <Pressable style={[styles.button, { backgroundColor: colors.danger }]} disabled={!!busy} onPress={() => act('archive', () => apiPatch(`/people/${id}/archive`, {}, token))}><Text style={styles.buttonText}>Archive</Text></Pressable>
          )}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
