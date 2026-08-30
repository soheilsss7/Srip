import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

type BriefAttendee = { person?: { firstName?: string; lastName?: string; displayName?: string } | null };

export default function MeetingBrief() {
  const { token } = useSession();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brief, setBrief] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMeetings = useCallback(async () => {
    if (!token) return;
    try {
      const x = await apiGet<any>('/meetings', token);
      setMeetings(Array.isArray(x) ? x : (x?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load meetings'); }
  }, [token]);
  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const select = async (id: string) => {
    if (!token) return;
    setSelectedId(id); setLoading(true); setError('');
    try {
      const m = await apiGet<any>(`/meetings/${id}`, token);
      setBrief(m);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load meeting brief'); }
    finally { setLoading(false); }
  };

  const rel = brief?.relationship;
  const people = Array.isArray(brief?.participants) ? brief.participants.map((p: BriefAttendee) => {
    const person = p.person;
    return person?.displayName ?? [person?.firstName, person?.lastName].filter(Boolean).join(' ') ?? 'Participant';
  }) : [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Meeting Brief</Text>
        <Text style={styles.subtitle}>Pick a meeting to review context: relationship health, participants, objectives and open work.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!meetings.length && !error ? <ActivityIndicator /> : meetings.map((m: any) => (
          <Pressable key={m.id} style={selectedId === m.id ? [styles.card, { borderColor: colors.accent, borderWidth: 1 }] : styles.card} onPress={() => select(m.id)}>
            <Text style={styles.value}>{m.title ?? 'Meeting'}</Text>
            <Text style={styles.subtitle}>{m.startAt ? new Date(m.startAt).toLocaleString() : m.id}</Text>
          </Pressable>
        ))}
        {loading ? <ActivityIndicator /> : null}
        {brief && (
          <View style={styles.card}>
            <Text style={styles.label}>Relationship health</Text>
            {rel ? (
              <>
                <Text style={styles.value}>{rel.healthScore ?? '—'} / 100 · {rel.status ?? 'Relationship'}</Text>
                <Text style={styles.subtitle}>{rel.sourceOrganization?.name ?? 'Source organization'} · {rel.targetOrganization?.name ?? 'Target organization'}</Text>
              </>
            ) : <Text style={styles.value}>No related relationship.</Text>}
          </View>
        )}
        {brief && (
          <View style={styles.card}>
            <Text style={styles.label}>Context</Text>
            {brief.objective ? <Text style={styles.value}>Objective: {brief.objective}</Text> : null}
            {brief.agenda ? <Text style={styles.value}>Agenda: {brief.agenda}</Text> : null}
            {brief.outcome ? <Text style={styles.value}>Outcome: {brief.outcome}</Text> : null}
            {people.length ? <Text style={styles.subtitle}>Participants: {people.join(', ')}</Text> : null}
            <Text style={styles.subtitle}>Open commitments: {Array.isArray(brief.commitments) ? brief.commitments.filter((c: any) => c.status === 'OPEN').length : 0} · Actions: {Array.isArray(brief.actions) ? brief.actions.length : 0}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}