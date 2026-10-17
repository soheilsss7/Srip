import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Item = { id: string; name?: string; status?: string; priority?: string; targetAt?: string };

export default function Projects() {
  const { token } = useSession();
  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const x = await apiGet<any>('/projects', token);
      setRows(Array.isArray(x) ? x : (x?.items ?? []));
      setTotal(typeof x?.total === 'number' ? x.total : (Array.isArray(x) ? x.length : 0));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Projects</Text>
        <Link href="/create-project"><Text style={{ color: colors.accent, fontWeight: '700' }}>New Project →</Text></Link>
        {!!total && <Text style={styles.subtitle}>{total} project{total === 1 ? '' : 's'}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!rows.length && !error && <ActivityIndicator />}
        {rows.map((r) => (
          <Link key={r.id} href={{ pathname: '/project/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.value}>{r.name ?? r.id}</Text>
              <Text style={styles.subtitle}>{r.status} · {r.priority}{r.targetAt ? ` · due ${new Date(r.targetAt).toLocaleDateString()}` : ''}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open detail →</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
