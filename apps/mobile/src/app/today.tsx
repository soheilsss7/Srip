import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type FollowUp = { id: string; title?: string; description?: string; status?: string; priority?: string; dueAt?: string };
type Meeting = { id: string; title: string; startAt: string };
const list = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : Array.isArray(value?.data) ? value.data : [];
const label = (item: FollowUp) => item.title || item.description || 'Follow-up';

export default function Today() {
  const { token } = useSession();
  const [overdueActions, setOverdueActions] = useState<FollowUp[]>([]);
  const [dueActions, setDueActions] = useState<FollowUp[]>([]);
  const [overdueCommitments, setOverdueCommitments] = useState<FollowUp[]>([]);
  const [dueCommitments, setDueCommitments] = useState<FollowUp[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError(''); setLoading(true);
    try {
      const [ao, ad, co, cd, mt] = await Promise.all([
        apiGet<any>('/actions/follow-up/overdue?page=1&pageSize=20', token),
        apiGet<any>('/actions/follow-up/due-soon?days=7&page=1&pageSize=20', token),
        apiGet<any>('/commitments/follow-up/overdue?page=1&pageSize=20', token),
        apiGet<any>('/commitments/follow-up/due-soon?days=7&page=1&pageSize=20', token),
        apiGet<any>('/meetings?upcoming=true&page=1&pageSize=10', token),
      ]);
      setOverdueActions(list(ao)); setDueActions(list(ad)); setOverdueCommitments(list(co)); setDueCommitments(list(cd)); setMeetings(list(mt));
    } catch (value) { setError(value instanceof Error ? value.message : 'Request failed'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { if (token) load(); else setLoading(false); }, [load, token]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const cards: Array<[string, FollowUp[], string]> = [['Overdue actions', overdueActions, '/actions'], ['Due soon actions', dueActions, '/actions'], ['Overdue commitments', overdueCommitments, '/commitments'], ['Due soon commitments', dueCommitments, '/commitments']];

  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
    <Text style={styles.title}>Today</Text><Text style={styles.subtitle}>Your operational follow-up queue.</Text>
    {error && <Text style={styles.error}>{error}</Text>}
    {loading ? <ActivityIndicator color={colors.accent} /> : <>
      <View style={styles.card}><Text style={styles.label}>Open follow-ups</Text><Text style={styles.value}>{overdueActions.length + dueActions.length + overdueCommitments.length + dueCommitments.length}</Text><Text style={styles.subtitle}>Overdue and due within seven days</Text></View>
      {cards.map(([title, rows, href]) => <View style={styles.card} key={title}><Text style={styles.sectionTitle}>{title} · {rows.length}</Text>{rows.length ? rows.slice(0, 5).map(item => <Link key={item.id} href={{ pathname: href === '/actions' ? '/action/[id]' : '/commitment/[id]', params: { id: item.id } }} asChild><Pressable style={styles.listRow}><Text style={styles.value}>{label(item)}</Text><Text style={styles.subtitle}>{item.status || item.priority || 'OPEN'}{item.dueAt ? ` · ${new Date(item.dueAt).toLocaleDateString()}` : ''}</Text></Pressable></Link>) : <Text style={styles.subtitle}>Nothing here.</Text>}</View>)}
      <View style={styles.card}><Text style={styles.sectionTitle}>Upcoming meetings · {meetings.length}</Text>{meetings.length ? meetings.map(meeting => <Link key={meeting.id} href={{ pathname: '/meeting/[id]', params: { id: meeting.id } }} asChild><Pressable style={styles.listRow}><Text style={styles.value}>{meeting.title}</Text><Text style={styles.subtitle}>{new Date(meeting.startAt).toLocaleString()}</Text></Pressable></Link>) : <Text style={styles.subtitle}>No upcoming meetings.</Text>}</View>
    </>}
  </ScrollView></SafeAreaView>;
}
