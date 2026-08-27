import React, { useState } from 'react';
import { SafeAreaView, Text, TextInput, Pressable, ScrollView, View, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Result = { type?: string; id?: string; title?: string; subtitle?: string; score?: number };
const ROUTE: Record<string, (id: string) => { pathname: string; params: Record<string, string> }> = {
  organization: (id) => ({ pathname: '/organization/[id]', params: { id } }),
  person: (id) => ({ pathname: '/person/[id]', params: { id } }),
  relationship: (id) => ({ pathname: '/relationship/[id]', params: { id } }),
  meeting: (id) => ({ pathname: '/meeting/[id]', params: { id } }),
  interaction: (id) => ({ pathname: '/interaction/[id]', params: { id } }),
};

export default function Search() {
  const { token } = useSession();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (!q.trim() || !token) return;
    setLoading(true); setError('');
    try {
      const x = await apiGet<any>(`/search?q=${encodeURIComponent(q.trim())}`, token);
      const results = x?.results ?? (Array.isArray(x) ? x : []);
      setRows(results); setTotal(typeof x?.total === 'number' ? x.total : results.length);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Search</Text>
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={run} placeholder="Search organizations, people, relationships, meetings..." style={styles.input} />
        <Pressable style={styles.button} onPress={run} disabled={loading}><Text style={styles.buttonText}>{loading ? 'Searching…' : 'Search'}</Text></Pressable>
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
      </ScrollView>
    </SafeAreaView>
  );
}
