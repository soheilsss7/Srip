import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View, ActivityIndicator, Alert } from 'react-native';
import { Link } from 'expo-router';
import { apiGet, apiPost, apiPatch, api } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Result = { type?: string; id?: string; title?: string; subtitle?: string; score?: number };
type Saved = { id: string; name: string; query: string; filters?: any; enabled: boolean; lastUsedAt?: string | null };
const ROUTE: Record<string, (id: string) => { pathname: string; params: Record<string, string> }> = {
  organization: (id) => ({ pathname: '/organization/[id]', params: { id } }),
  person: (id) => ({ pathname: '/person/[id]', params: { id } }),
  relationship: (id) => ({ pathname: '/relationship/[id]', params: { id } }),
  meeting: (id) => ({ pathname: '/meeting/[id]', params: { id } }),
  interaction: (id) => ({ pathname: '/interaction/[id]', params: { id } }),
  project: (id) => ({ pathname: '/project/[id]', params: { id } }),
  opportunity: (id) => ({ pathname: '/opportunity/[id]', params: { id } }),
  document: (id) => ({ pathname: '/documents', params: { focus: id } }),
  note: (id) => ({ pathname: '/interactions', params: {} }),
};
const arr = (x: any) => Array.isArray(x) ? x : (x?.items ?? []);

export default function Search() {
  const { token } = useSession();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [saveName, setSaveName] = useState('');

  const loadSaved = useCallback(async () => {
    if (!token) return;
    try { setSaved(arr(await apiGet<any>('/search/saved', token))); } catch { /* saved search unavailable */ } finally { setSavedLoading(false); }
  }, [token]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label); setError('');
    try { await fn(); await loadSaved(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }
  async function run() {
    if (!q.trim() || !token) return;
    setLoading(true); setError('');
    try {
      const x = await apiGet<any>(`/search?q=${encodeURIComponent(q.trim())}`, token);
      const results = x?.results ?? (Array.isArray(x) ? x : []);
      setRows(results); setTotal(typeof x?.total === 'number' ? x.total : results.length);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  async function saveIt() {
    if (!saveName.trim() || q.trim().length < 2) { setError('نام و عبارت جستجو (حداقل ۲ نویسه) لازم است.'); return; }
    await act('save', () => apiPost('/search/saved', { name: saveName.trim(), query: q, enabled: true, filters: {} }, token));
    setSaveName('');
  }
  async function runSaved(s: Saved) {
    if (!token) return;
    setBusy('run' + s.id); setError('');
    try { const r: any = await apiPost(`/search/saved/${s.id}/run`, {}, token); setQ(r?.q ?? s.query ?? ''); const results = r?.results ?? []; setRows(results); setTotal(r?.total ?? results.length); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }
  async function toggleSaved(s: Saved) {
    await act('toggle' + s.id, () => apiPatch(`/search/saved/${s.id}`, { enabled: !s.enabled }, token));
  }
  async function deleteSaved(s: Saved) {
    Alert.alert('حذف جستجوی ذخیره‌شده', `«${s.name}» حذف شود؟`, [
      { text: 'لغو', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => act('del' + s.id, () => api(`/search/saved/${s.id}`, { method: 'DELETE' }, token)) },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Search</Text>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={run} placeholder="Search organizations, people, relationships, meetings..." style={styles.input} />
        <Pressable style={styles.button} onPress={run} disabled={loading}><Text style={styles.buttonText}>{loading ? 'Searching…' : 'Search'}</Text></Pressable>
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={saveName} onChangeText={setSaveName} placeholder="نام جستجوی ذخیره‌شده" />
          <Pressable style={styles.button} onPress={saveIt} disabled={!!busy}><Text style={styles.buttonText}>ذخیره جستجو</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!!total && <Text style={styles.subtitle}>{total} result{total === 1 ? '' : 's'}</Text>}
        <ActivityIndicator animating={loading} />
        {rows.map((x, i) => {
          const href = x.id ? ROUTE[x.type ?? '']?.(x.id) : null;
          return href ? (
            <Link key={x.id ?? i} href={href} asChild>
              <Pressable style={styles.card}>
                <Text style={styles.value}>{x.title ?? x.id}</Text>
                <Text style={styles.label}>{x.type} · {x.subtitle ?? ''}</Text>
                {typeof x.score === 'number' ? <Text style={{ color: colors.accent, fontWeight: '700' }}>{Math.round(x.score)}%</Text> : null}
              </Pressable>
            </Link>
          ) : (
            <View key={x.id ?? i} style={styles.card}>
              <Text style={styles.value}>{x.title ?? x.id}</Text>
              <Text style={styles.label}>{x.type} · {x.subtitle ?? ''}</Text>
            </View>
          );
        })}

        <Text style={styles.title}>Saved searches</Text>
        {savedLoading ? <ActivityIndicator /> : saved.length === 0 ? <Text style={{ color: colors.muted }}>No saved searches yet.</Text> : saved.map((s) => (
          <View key={s.id} style={styles.card}>
            <Text style={styles.value}>{s.name}</Text>
            <Text style={styles.label}>{s.query || '(بدون عبارت)'}{!s.enabled ? ' · disabled' : ''}</Text>
            <View style={styles.row}>
              <Pressable style={styles.button} disabled={!!busy} onPress={() => runSaved(s)}><Text style={styles.buttonText}>اجرا</Text></Pressable>
              <Pressable style={styles.button} disabled={!!busy} onPress={() => toggleSaved(s)}><Text style={styles.buttonText}>{s.enabled ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</Text></Pressable>
              <Pressable style={[styles.button, { backgroundColor: colors.danger }]} disabled={!!busy} onPress={() => deleteSaved(s)}><Text style={styles.buttonText}>حذف</Text></Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
