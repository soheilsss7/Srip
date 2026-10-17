import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { clearQueue, queuedMutations, QueuedMutation } from '../services/offline-queue';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

export default function OfflineQueue() {
  const { syncOffline } = useSession();
  const [items, setItems] = useState<QueuedMutation[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setItems(await queuedMutations());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function flush() {
    setBusy(true); setMsg('');
    try {
      const result = await syncOffline();
      setMsg(`Sent: ${result.sent} · Remaining: ${result.remaining}${result.failed > 0 ? ` · Permanently failed (dropped): ${result.failed}` : ''}`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Sync failed'); }
    finally { setBusy(false); }
  }

  async function dropAll() {
    Alert.alert('Clear queue', 'Remove all queued mutations? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearQueue(); setMsg('Queue cleared.'); await load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Offline Queue</Text>
        <Text style={styles.subtitle}>Mutations recorded while offline are delivered in order when connectivity returns. Permanent validation failures (4xx) are never retried silently.</Text>
        {items.length === 0 ? <Text style={{ color: colors.muted }}>Queue is empty.</Text> : items.map((it) => (
          <View key={it.id} style={styles.card}>
            <Text style={styles.value}>{it.method} {it.path}</Text>
            <Text style={styles.subtitle}>attempts: {it.attempts} · {new Date(it.createdAt).toLocaleString()}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable style={[styles.button, { flex: 1 }]} disabled={busy} onPress={flush}><Text style={styles.buttonText}>{busy ? 'Syncing…' : 'Sync now'}</Text></Pressable>
          <Pressable style={[styles.button, { flex: 1 }]} disabled={busy || items.length === 0} onPress={dropAll}><Text style={styles.buttonText}>Clear queue</Text></Pressable>
        </View>
        {msg ? <Text style={styles.subtitle}>{msg}</Text> : null}
        <ActivityIndicator animating={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}