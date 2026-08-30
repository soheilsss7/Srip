import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiGet } from '../services/api-client';
import { useSession } from '../state/session';
import { styles, colors } from '../lib/ui';
import NetworkGraph, { NetworkGraphHandle } from '../features/network-graph';
import {
  GEdge,
  GGraph,
  GNode,
  edgeDisplayLabel,
  kindLabel,
  nodeDisplayName,
  nodeEntityRoute,
} from '../features/graph-model';

const STATUSES = ['PROSPECTIVE', 'ACTIVE', 'AT_RISK', 'DORMANT', 'ARCHIVED'];
const PAGE_LIMIT = 500;
const ANALYTICS = [
  ['centrality', 'Centrality'],
  ['connectors', 'Connectors'],
  ['bridges', 'Bridge people'],
  ['bottlenecks', 'Bottlenecks'],
  ['single-points-of-failure', 'Single points of failure'],
] as const;

interface FilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        marginRight: 6,
        marginBottom: 6,
        backgroundColor: active ? colors.accent : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 3 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

function NodeDetailsModal({
  node,
  onClose,
  onExpand,
}: {
  node: GNode;
  onClose: () => void;
  onExpand: () => void;
}) {
  const router = useRouter();
  const route = nodeEntityRoute(node);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,51,0.36)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close node details" />
        <View
          accessible
          accessibilityLabel={`${node.type} details`}
          style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 30, gap: 12 }}
        >
          <Text style={[styles.subtitle, { textTransform: 'uppercase' }]}>{node.type}</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{nodeDisplayName(node)}</Text>
          <DetailRow label="Entity type" value={String(node.type)} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable
              style={styles.button}
              disabled={!route}
              onPress={() => route && router.push(route.path)}
              accessibilityRole="button"
              accessibilityLabel="Open entity"
            >
              <Text style={styles.buttonText}>{`Open ${node.type}`}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.accent }]}
              onPress={onExpand}
              accessibilityRole="button"
              accessibilityLabel="Expand neighbors"
            >
              <Text style={{ color: colors.accent, fontWeight: '700', textAlign: 'center' }}>Expand (focus)</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EdgeDetailsModal({ edge, onClose }: { edge: GEdge; onClose: () => void }) {
  const router = useRouter();
  const hasNum = (v: number) => Number.isFinite(v);
  const isOrgRelationship = edge.kind === 'relationship';
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,32,51,0.36)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close edge details" />
        <View
          accessible
          accessibilityLabel="Edge details"
          style={{ backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 30, gap: 12 }}
        >
          <Text style={[styles.subtitle, { textTransform: 'uppercase' }]}>Edge</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{edgeDisplayLabel(edge)}</Text>
          <DetailRow label="Kind" value={kindLabel(edge.kind)} />
          {edge.label ? <DetailRow label="Relationship type" value={edge.label} /> : null}
          {hasNum(edge.weight) ? <DetailRow label="Weight" value={String(edge.weight)} /> : null}
          {hasNum(edge.risk) ? <DetailRow label="Risk" value={String(edge.risk)} /> : null}
          {hasNum(edge.strategicImportance) ? <DetailRow label="Strategic importance" value={String(edge.strategicImportance)} /> : null}
          <DetailRow label="Source" value={edge.source} />
          <DetailRow label="Target" value={edge.target} />
          {isOrgRelationship && edge.source.startsWith('org:') && edge.target.startsWith('org:') ? (
            <Pressable
              style={styles.button}
              onPress={() => router.push(`/relationship/${edge.id}`)}
              accessibilityRole="button"
              accessibilityLabel="Open relationship"
            >
              <Text style={styles.buttonText}>Open relationship</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export default function Network() {
  const { token } = useSession();
  const [graph, setGraph] = useState<GGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [focus, setFocus] = useState('');

  const [mode, setMode] = useState<'shortest' | 'best'>('shortest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [path, setPath] = useState<any>(null);

  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisKind, setAnalysisKind] = useState('centrality');

  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GEdge | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const graphRef = useRef<NetworkGraphHandle | null>(null);
  // Monotonic request sequence + mounted guard: only the most recent request may apply
  // its result, and async work never updates state after unmount (avoids stale overwrites
  // during rapid filter/focus/analytics changes and setState-after-unmount).
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      seqRef.current += 1; // invalidate any in-flight request on unmount
    };
  }, []);
  const isCurrent = useCallback((seq: number) => mountedRef.current && seq === seqRef.current, []);
  const beginRequest = useCallback(() => {
    seqRef.current += 1;
    return seqRef.current;
  }, []);

  const load = useCallback(
    async (cursor?: string, append = false) => {
      if (!token) return;
      const seq = beginRequest();
      setError('');
      if (append) setLoadingMore(true);
      else setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (type !== 'all') params.set('type', type);
      if (status) params.set('status', status);
      if (focus) params.set('focus', focus);
      params.set('limit', String(PAGE_LIMIT));
      if (cursor) params.set('cursor', cursor);
      try {
        const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`, token);
        if (!isCurrent(seq)) return;
        setGraph((prev) => {
          if (append && prev) {
            const seenN = new Set(prev.nodes.map((n) => n.id));
            const newNodes = data.nodes.filter((n) => !seenN.has(n.id));
            const seenE = new Set(prev.edges.map((e) => e.id));
            const newEdges = data.edges.filter((e) => !seenE.has(e.id));
            return { ...data, nodes: [...prev.nodes, ...newNodes], edges: [...prev.edges, ...newEdges] };
          }
          return data;
        });
      } catch (e) {
        if (!isCurrent(seq)) return;
        setError(e instanceof Error ? e.message : 'Unable to load network');
      } finally {
        if (isCurrent(seq)) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [token, q, type, status, focus, beginRequest, isCurrent],
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
  };

  const selected = selectedNode;

  const nodeIds = useMemo(() => new Set(graph?.nodes.map((n) => n.id) ?? []), [graph]);
  const orgNodes = useMemo(() => graph?.nodes.filter((n) => n.type === 'organization') ?? [], [graph]);

  // A selection is only meaningful while its node/edge still exists in the loaded graph.
  // Drop stale selections after a filter/focus/pagination refresh removes their target.
  useEffect(() => {
    if (!graph) return;
    if (selectedNode && !nodeIds.has(selectedNode.id)) setSelectedNode(null);
    if (selectedEdge) {
      const stillPresent = graph.edges.some((e) => e.id === selectedEdge.id);
      if (!stillPresent) setSelectedEdge(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const pathNodeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.nodes ?? []).forEach((n: any) => n?.id && s.add(n.id));
    return s;
  }, [path]);
  const pathEdgeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.edges ?? []).forEach((e: any) => e?.id && s.add(e.id));
    return s;
  }, [path]);

  const analysisList = useMemo(
    () => (Array.isArray(analysis) ? analysis : analysis?.items ?? []),
    [analysis],
  );
  const analysisNodeSet = useMemo(() => {
    const s = new Set<string>();
    analysisList.forEach((r: any) => r?.node?.id && s.add(r.node.id));
    return s;
  }, [analysisList]);

  const activeFilters: FilterChip[] = [];
  if (q) activeFilters.push({ key: 'q', label: `q: ${q}`, onClear: () => setQ('') });
  if (type !== 'all') activeFilters.push({ key: 'type', label: `type: ${type}`, onClear: () => setType('all') });
  if (status) activeFilters.push({ key: 'status', label: `status: ${status}`, onClear: () => setStatus('') });
  if (focus) {
    const fn = graph?.nodes.find((n) => n.id === focus);
    activeFilters.push({ key: 'focus', label: `focus: ${fn ? nodeDisplayName(fn) : focus}`, onClear: () => setFocus('') });
  }

  const runPath = async () => {
    if (!from || !to || !token) return;
    const seq = beginRequest();
    setError('');
    try {
      const result = await apiGet(`/network/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`, token);
      if (isCurrent(seq)) setPath(result);
    } catch (e) {
      if (!isCurrent(seq)) return;
      setError(e instanceof Error ? e.message : 'Unable to calculate path');
    }
  };
  const clearPath = () => setPath(null);

  const runAnalysis = async (endpoint: string) => {
    if (!token) return;
    const seq = beginRequest();
    setError('');
    setAnalysisKind(endpoint);
    try {
      const result = await apiGet(`/network/${endpoint}`, token);
      if (isCurrent(seq)) setAnalysis(result);
    } catch (e) {
      if (!isCurrent(seq)) return;
      setError(e instanceof Error ? e.message : 'Unable to load analysis');
    }
  };

  const expandNode = (node: GNode) => {
    setSelectedNode(null);
    if (focus !== node.id) setFocus(node.id);
  };
  const clearFocus = () => {
    setFocus('');
    setSelectedNode(null);
  };

  const selectAnalyticsNode = (id: string) => {
    const node = graph?.nodes.find((n) => n.id === id) ?? null;
    setSelectedNode(node);
  };

  const pathActive = Boolean(path?.found && pathNodeSet.size > 0);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.title}>Network Intelligence</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!graph && loading ? <ActivityIndicator accessibilityLabel="Loading network" /> : null}
        {!graph && !loading && error ? (
          <Pressable style={styles.button} onPress={() => load()} accessibilityRole="button" accessibilityLabel="Retry loading network">
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : null}

        {graph && (
          <>
            <Text style={styles.subtitle}>
              {graph.meta.organizationCount} orgs · {graph.meta.peopleCount} people · {graph.meta.projectCount} projects ·{' '}
              {graph.meta.relationshipCount} org rels
            </Text>

            {/* Filters */}
            <View style={styles.card}>
              <Text style={styles.label}>Filters</Text>
              <TextInput
                style={styles.input}
                value={q}
                onChangeText={setQ}
                placeholder="Search organizations, people, projects"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Search network"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {(['all', 'organization', 'person', 'project'] as const).map((t) => (
                  <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {STATUSES.map((s) => (
                  <Chip key={s} label={s} active={status === s} onPress={() => setStatus(status === s ? '' : s)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Chip label={focus ? 'Focus: on' : 'Focus: off'} active={Boolean(focus)} onPress={clearFocus} />
              </View>
              <Pressable style={styles.button} onPress={() => load()} disabled={loading} accessibilityRole="button" accessibilityLabel="Apply filters" accessibilityState={{ disabled: loading }}>
                <Text style={styles.buttonText}>Apply</Text>
              </Pressable>
              {activeFilters.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                  {activeFilters.map((f) => (
                    <Chip key={f.key} label={f.label} active onPress={f.onClear} />
                  ))}
                </View>
              ) : null}
            </View>

            {/* Graph */}
            <View style={styles.card}>
              <Text style={styles.label}>Graph</Text>
              <NetworkGraph
                ref={graphRef}
                graph={graph}
                selectedNodeId={selected?.id ?? null}
                selectedEdgeId={selectedEdge?.id ?? null}
                focusNodeId={focus || null}
                pathNodeIds={pathActive ? pathNodeSet : null}
                pathEdgeIds={pathActive ? pathEdgeSet : null}
                analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                dimOthers={Boolean(selectedNode)}
                onSelectNode={setSelectedNode}
                onSelectEdge={setSelectedEdge}
              />
              {focus ? (
                <Pressable style={[styles.button, { marginTop: 8 }]} onPress={clearFocus}>
                  <Text style={styles.buttonText}>Clear focus (broader view)</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Organization path */}
            <View style={styles.card}>
              <Text style={styles.label}>Organization path</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {orgNodes.map((n) => (
                  <Chip key={`from-${n.id}`} label={`From: ${nodeDisplayName(n).slice(0, 18)}`} active={from === n.id} onPress={() => setFrom(n.id)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {orgNodes.map((n) => (
                  <Chip key={`to-${n.id}`} label={`To: ${nodeDisplayName(n).slice(0, 18)}`} active={to === n.id} onPress={() => setTo(n.id)} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Shortest" active={mode === 'shortest'} onPress={() => setMode('shortest')} />
                <Chip label="Best" active={mode === 'best'} onPress={() => setMode('best')} />
              </View>
              <Pressable style={styles.button} onPress={runPath} disabled={!from || !to} accessibilityRole="button" accessibilityLabel="Find path" accessibilityState={{ disabled: !from || !to }}>
                <Text style={styles.buttonText}>Find path</Text>
              </Pressable>
              {path ? (
                <>
                  <Text style={styles.value}>{path.found ? `Found: ${path.hops} hop${path.hops === 1 ? '' : 's'} · cost ${path.totalCost ?? '—'}` : 'No visible path found'}</Text>
                  <Pressable style={styles.button} onPress={clearPath}>
                    <Text style={styles.buttonText}>Clear path</Text>
                  </Pressable>
                </>
              ) : null}
            </View>

            {/* Analytics */}
            <View style={styles.card}>
              <Text style={styles.label}>Network analysis</Text>
              <Text style={{ ...styles.subtitle, marginBottom: 4 }}>
                Tap a highlighted result to select that node in the graph.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {ANALYTICS.map(([key, label]) => (
                  <Chip key={key} label={label} active={analysisKind === key} onPress={() => runAnalysis(key)} />
                ))}
              </View>
              {analysisList.length === 0 ? (
                <Text style={{ color: colors.muted }}>No results.</Text>
              ) : (
                analysisList.slice(0, 40).map((x: any, i: number) => {
                  const n: any = x?.node;
                  const id = n?.id ?? null;
                  const name = n?.label ?? n?.displayName ?? n?.name ?? (typeof n === 'string' ? n : 'Item');
                  const scoreKey = Object.keys(x ?? {}).find((k) => k !== 'node' && x[k] != null);
                  const inSet = id && analysisNodeSet?.has(id);
                  return (
                    <Pressable
                      key={x?.node?.id ?? i}
                      disabled={!inSet}
                      onPress={() => inSet && selectAnalyticsNode(id)}
                      accessibilityRole="button"
                      accessibilityLabel={String(name)}
                      style={{
                        minHeight: 44,
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        flexDirection: 'row',
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <Text style={{ color: inSet ? colors.accent : colors.text, fontWeight: inSet ? '800' : '500', flexShrink: 1 }}>
                        {String(name)}
                      </Text>
                      {scoreKey ? <Text style={{ color: colors.muted }}>{String(x[scoreKey])}</Text> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {selectedNode ? (
        <NodeDetailsModal node={selectedNode} onClose={() => setSelectedNode(null)} onExpand={() => expandNode(selectedNode)} />
      ) : null}
      {selectedEdge ? <EdgeDetailsModal edge={selectedEdge} onClose={() => setSelectedEdge(null)} /> : null}
    </SafeAreaView>
  );
}
