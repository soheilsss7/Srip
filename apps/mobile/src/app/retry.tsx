import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { queuedMutations } from '../services/offline-queue';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

export default function Retry() {
  const { syncOffline } = useSession();
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const items = await queuedMutations();
    setCount(items.length);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function retry() {
    setBusy(true); setMsg('');
    try {
      const result = await syncOffline();
      setMsg(`Sent: ${result.sent} · Remaining: ${result.remaining}${result.failed > 0 ? ` · Failed permanently: ${result.failed}` : ''}`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Retry failed'); }
    finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Retry</Text>
        <Text style={styles.subtitle}>Queued mutations track attempts and remain local until successfully delivered. A mutation rejected with a permanent (4xx) error is dropped instead of retried forever.</Text>
        <View style={styles.card}>
          <Text style={styles.value}>{count} queued mutation{count === 1 ? '' : 's'}</Text>
        </View>
        <Pressable style={styles.button} disabled={busy} onPress={retry}><Text style={styles.buttonText}>{busy ? 'Retrying…' : 'Retry now'}</Text></Pressable>
        {msg ? <Text style={styles.subtitle}>{msg}</Text> : null}
        <Link href="/offline-queue" style={styles.buttonText}>Open offline queue →</Link>
        <Link href="/sync" style={styles.buttonText}>Sync →</Link>
      </ScrollView>
    </SafeAreaView>
  );
}