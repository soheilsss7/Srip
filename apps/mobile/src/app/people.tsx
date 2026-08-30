import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type Item = { id: string; displayName?: string; firstName?: string; lastName?: string; title?: string; organization?: { name?: string } };

export default function People() {
  const { token, can } = useSession();
  const canCreate = can('person.write');
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const x = await apiGet<any>('/people', token);
      setRows(Array.isArray(x) ? x : (x?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>People</Text>
        {canCreate && <Link href={{ pathname: '/create-person' }} asChild>
          <Pressable style={styles.button}><Text style={styles.buttonText}>+ New Person</Text></Pressable>
        </Link>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!rows.length && !error && <ActivityIndicator />}
        {rows.map((r) => (
          <Link key={r.id} href={{ pathname: '/person/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.value}>{r.displayName ?? (`${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.id)}</Text>
              <Text style={styles.subtitle}>{r.title} · {r.organization?.name}</Text>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open detail →</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
