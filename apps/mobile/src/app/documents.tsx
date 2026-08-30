import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import { EntityPicker } from '../features/entity-picker';

type Doc = { id: string; name: string; classification?: string; mimeType?: string; sizeBytes?: number; uploadStatus?: string; scanStatus?: string; createdAt?: string };

export default function Documents() {
  const { token, can } = useSession();
  const canWrite = can('document.write');
  const [rows, setRows] = useState<Doc[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [orgId, setOrgId] = useState('');
  const [orgLabel, setOrgLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [indexText, setIndexText] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const x = await apiGet<any>('/documents', token);
      setRows(Array.isArray(x) ? x : (x?.items ?? []));
      apiGet<any>('/documents/status', token).then(setStatus).catch(() => undefined);
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  async function pickAndUpload() {
    if (!token || !canWrite) return;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as any);
      if (orgId.trim()) form.append('organizationId', orgId.trim());
      form.append('classification', 'INTERNAL');
      setBusy(true); setMsg('');
      const out = await api<any>('/documents/upload', { method: 'POST', body: form }, token);
      setMsg(`Uploaded: ${(out as any)?.document?.name ?? asset.name}`);
      load();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function download(doc: Doc) {
    if (!token) return;
    try {
      const out = await apiGet<any>(`/documents/${doc.id}/signed-url`, token);
      const url = out?.url;
      if (!url) throw new Error('No signed URL returned');
      Linking.openURL(url).catch(() => Alert.alert('Open document', url));
    } catch (e) { Alert.alert('Download', (e as Error).message); }
  }
  async function indexDoc(doc: Doc, text: string) {
    if (!token) return;
    try { await api<any>(`/documents/${doc.id}/index`, { method: 'POST', body: JSON.stringify({ text }) }, token); Alert.alert('Index', 'Indexing content submitted.'); setIndexText(''); }
    catch (e) { Alert.alert('Index', (e as Error).message); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Documents</Text>
        {status && (
          <View style={styles.card}>
            <Text style={styles.label}>Library status</Text>
            {typeof status === 'object' && status !== null ? <>
              {status.module ? <Text style={styles.value}>Module: {String(status.module)}</Text> : null}
              {status.status ? <Text style={styles.value}>Status: {String(status.status)}</Text> : null}
              {Array.isArray(status.capabilities) && status.capabilities.length ? <>
                <Text style={styles.label}>Capabilities</Text>
                {status.capabilities.map((c: string, i: number) => <Text key={`${i}-${c}`} style={styles.subtitle}>• {c}</Text>)}
              </> : null}
            </> : <Text style={styles.value}>{String(status)}</Text>}
          </View>
        )}
        {canWrite && <><EntityPicker label="Organization (optional)" endpoint="/organizations" value={orgId} selectedLabel={orgLabel} onChange={(value, label) => { setOrgId(value); setOrgLabel(label ?? ''); }} disabled={busy} />
        <Pressable style={styles.button} disabled={busy} onPress={pickAndUpload}><Text style={styles.buttonText}>{busy ? 'Uploading…' : 'Upload document'}</Text></Pressable></>}
        {!canWrite && <Text style={styles.subtitle}>You have read-only access to documents.</Text>}
        {msg ? <Text style={{ color: colors.success }}>{msg}</Text> : null}
        {error && <Text style={styles.error}>{error}</Text>}
        {!rows.length && !error && <ActivityIndicator />}
        {rows.map((d) => (
          <View key={d.id} style={styles.card}>
            <Pressable onPress={() => download(d)}>
              <Text style={styles.value}>{d.name}</Text>
              <Text style={styles.subtitle}>{d.classification} · {d.mimeType} · {(d.sizeBytes ?? 0) > 0 ? `${d.sizeBytes} B` : ''}</Text>
              <Text style={styles.label}>{d.uploadStatus} · {d.scanStatus} · tap to download</Text>
            </Pressable>
            {canWrite && <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Index content text" value={indexText} onChangeText={setIndexText} />
              <Pressable style={styles.button} onPress={() => indexDoc(d, indexText)}><Text style={styles.buttonText}>Index</Text></Pressable>
            </View>}
          </View>
        ))}
        {!rows.length && !error && <Text style={{ color: colors.muted }}>No documents yet.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}