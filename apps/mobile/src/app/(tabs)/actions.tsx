import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { apiGet } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

type Item = { id: string; title?: string; status?: string; priority?: string; dueAt?: string; owner?: { name?: string } };

export default function ActionsTab() {
  const { token } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const x = await apiGet<any>('/actions', token);
      setRows(Array.isArray(x) ? x : (x?.items ?? []));
      setTotal(typeof x?.total === 'number' ? x.total : (Array.isArray(x) ? x.length : 0));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Actions</Text>
        {!!total && <Text style={styles.subtitle}>{total} action{total === 1 ? '' : 's'}</Text>}
        <Pressable style={styles.button} onPress={() => router.push('/create-action')}><Text style={styles.buttonText}>New action</Text></Pressable>
        {error && <Text style={styles.error}>{error}</Text>}
        {!rows.length && !error && <ActivityIndicator />}
        {!rows.length && error && <Text style={{ color: colors.muted }}>No actions.</Text>}
        {rows.map((r) => (
          <Link key={r.id} href={{ pathname: '/action/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.value}>{r.title ?? r.id}</Text>
              <Text style={styles.subtitle}>{r.status}{r.priority ? ` · ${r.priority}` : ''}{r.dueAt ? ` · due ${new Date(r.dueAt).toLocaleDateString()}` : ''}{r.owner?.name ? ` · ${r.owner.name}` : ''}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open detail →</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}