import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../../services/api-client';
import { useSession } from '../../state/session';
import { styles, colors } from '../../lib/ui';

type Item = { id: string; status?: string; healthScore?: number; strategicScore?: number; relationshipType?: string };

export default function RelationshipsTab() {
  const { token } = useSession();
  const [rows, setRows] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const x = await apiGet<any>('/relationships', token);
      setRows(Array.isArray(x) ? x : (x?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Relationships</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {!rows.length && !error && <ActivityIndicator />}
        {rows.map((r) => (
          <Link key={r.id} href={{ pathname: '/relationship/[id]', params: { id: r.id } }} asChild>
            <Pressable style={styles.card}>
              <Text style={styles.value}>{r.relationshipType ?? 'Relationship'}</Text>
              <Text style={styles.subtitle}>{r.id}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Status: {r.status ?? '—'}</Text>
                <Text style={styles.label}>Health: {r.healthScore ?? '—'}</Text>
                <Text style={styles.label}>Strategic: {r.strategicScore ?? '—'}</Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Open detail →</Text>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
