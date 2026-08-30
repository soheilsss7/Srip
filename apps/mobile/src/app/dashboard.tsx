import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';

export default function Dashboard() {
  const { token, can } = useSession();
  const canRead = can('report.read');
  const [data, setData] = useState<any>(null);
  const [overdueCommitments, setOverdueCommitments] = useState<any[]>([]);
  const [overdueActions, setOverdueActions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token || !canRead) return;
    setError(null);
    try {
      const [summary, commits, actions] = await Promise.all([
        apiGet<any>('/reports/executive-summary', token),
        can('commitment.read') ? apiGet<any>('/commitments/follow-up/overdue', token) : Promise.resolve({ items: [] }),
        can('action.read') ? apiGet<any>('/actions/follow-up/overdue', token) : Promise.resolve({ items: [] }),
      ]);
      setData(summary);
      setOverdueCommitments(Array.isArray(commits) ? commits : (commits?.items ?? []));
      setOverdueActions(Array.isArray(actions) ? actions : (actions?.items ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
  }, [can, canRead, token]);
  useEffect(() => { load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const kpi = data?.kpi ?? {};
  const summary = data?.summary ?? {};
  const kpis: [string, unknown][] = [
    ['Companies', summary.companies],
    ['Relationships', summary.relationships],
    ['Healthy', summary.healthyRelationships],
    ['At risk', summary.atRiskRelationships],
    ['Open opportunities', summary.openOpportunities],
    ['Projects', summary.projects],
    ['Overdue project work', summary.projectsWithOverdueWork],
    ['Upcoming meetings', summary.upcomingMeetings],
    ['Avg relationship health', kpi.averageRelationshipHealth],
    ['Avg relationship risk', kpi.averageRelationshipRisk],
    ['Weighted opportunity value', kpi.weightedOpportunityValue],
  ];

  if (!canRead) return <SafeAreaView style={styles.screen}><View style={styles.content}><Text style={styles.title}>Dashboard</Text><Text style={styles.error}>You do not have permission to view the dashboard.</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.title}>Dashboard</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {!data && !error && <ActivityIndicator />}

        {data && <>
          <View style={styles.card}>
            <Text style={styles.label}>By the numbers</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {kpis.map(([k, v]) => (
                <View key={String(k)} style={{ minWidth: '46%', flexGrow: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.bg }}>
                  <Text style={styles.label}>{String(k)}</Text>
                  <Text style={styles.value}>{(v == null ? '—' : String(v)) as any}</Text>
                </View>
              ))}
            </View>
            {data.generatedAt ? <Text style={{ color: colors.muted, marginTop: 6 }}>Generated {new Date(data.generatedAt).toLocaleString()}</Text> : null}
          </View>

          {Array.isArray(data.risks) && data.risks.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.label}>Relationships at risk</Text>
              {data.risks.slice(0, 10).map((r: any) => (
                <View key={r.id} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text style={styles.value}>{r.sourceOrganization?.name ?? r.sourceOrganization ?? 'Source organization'} → {r.targetOrganization?.name ?? r.targetOrganization ?? 'Target organization'}</Text>
                  <Text style={styles.subtitle}>health {r.healthScore} · risk {r.riskScore}</Text>
                </View>
              ))}
            </View>
          )}
        </>}

        <View style={styles.card}>
          <Text style={styles.label}>Overdue commitments</Text>
          {!overdueCommitments.length && !error ? <Text style={{ color: colors.muted }}>None overdue.</Text> : overdueCommitments.map((c: any) => (
            <Link key={c.id} href={{ pathname: '/commitment/[id]', params: { id: c.id } }} asChild>
              <Pressable style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{c.description}</Text>
                <Text style={styles.subtitle}>due {new Date(c.dueAt).toLocaleDateString()}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Overdue actions</Text>
          {!overdueActions.length && !error ? <Text style={{ color: colors.muted }}>None overdue.</Text> : overdueActions.map((a: any) => (
            <Link key={a.id} href={{ pathname: '/action/[id]', params: { id: a.id } }} asChild>
              <Pressable style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={styles.value}>{a.title}</Text>
                <Text style={styles.subtitle}>due {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : ''}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}