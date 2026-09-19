'use client';
import { ShieldCheck, Network, Lightbulb, AlertTriangle, Zap, Maximize, Maximize2, X, Target, Clock, Layers, UserPlus, BrainCircuit } from 'lucide-react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet, apiPost } from '../_lib/api';
import {fa} from '../_lib/fa';
import { useWorkspace } from '../_components/workspace';
import { Badge, Empty, ErrorCard, Loading } from '../_components/page-ui';
import { CriteriaRailChip } from '../_components/criteria';
import {
  GGraph,
  GNode,
  GEdge,
  RISK_THRESHOLD,
  PATH_COLOR,
  kindLabel,
  nodeDisplayName,
  nodeEntityRoute,
  edgeStatus,
  statusMeta,
  PUBLIC_CATEGORY_ORDER,
  PUBLIC_CATEGORY_META,
  EGO_COLOR,
  EGO_FA,
} from './_nodes';
import NetworkGraph, { NetworkGraphHandle } from './_graph';
import PresentationMode from '../_components/presentation-mode';
import { localeTag, lt, t } from '../_lib/i18n';

const COLUMN_LABELS: Record<string, string> = lt({
  TEAM: t('تیم ما'), CUSTOMER: t('مشتری'), BOARD_ADVISORS: t('هیئت و مشاوران'), PARTNERS: t('شرکا'),
});
const fmtNum = (v: any): string => { const n = Number(v); return Number.isFinite(n) ? new Intl.NumberFormat(localeTag()).format(n) : '—'; };
// نمایش فارسی شناسه‌ها (org:org-1 → «سازمان ۱»)
const faEntityId = (id: any): string => {
  if (id == null) return '—';
  const raw = String(id);
  const digits = raw.match(/\d+/g);
  const num = digits ? fmtNum(Number(digits[digits.length - 1] ?? 0)) : null;
  const l = raw.toLowerCase();
  let label = '';
  if (l.startsWith('org:') || l.startsWith('org-')) label = t('سازمان');
  else if (l.startsWith('project:') || l.startsWith('project-') || l.startsWith('pr-')) label = t('پروژه');
  else if (l.startsWith('person:') || l.startsWith('person-') || l.startsWith('p-')) label = t('شخص');
  else if (l.startsWith('e-')) label = t('پیوند');
  else if (l.startsWith('rel') || l.startsWith('r-')) label = t('رابطه');
  return label && num ? `${label} ${num}` : (num ? `${t('شمارهٔ')} ${num}` : raw);
};

// A crash inside the graph must never blank the whole page.
class GraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return (
        <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
          <p>{t('نمایش گراف با خطا مواجه شد.')}</p>
          <button className="net-btn primary" onClick={() => this.setState({ failed: false })}>
            {t('تلاش دوباره')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const STATUSES = ['ACTIVE', 'AT_RISK', 'DORMANT', 'PROSPECTIVE', 'ARCHIVED'];
const PAGE_LIMIT = 500;
/** Stable empty graph — module constant so its identity never changes between renders. */
const EMPTY_GRAPH: GGraph = {
  nodes: [], edges: [],
  meta: { organizationCount: 0, peopleCount: 0, projectCount: 0, relationshipCount: 0, personRelationshipCount: 0 },
  page: { limit: PAGE_LIMIT, nextCursor: null, bounded: true },
};

function bucketize(vals: number[], bins = 8): number[] {
  const out = new Array(bins).fill(0);
  if (!vals.length) return out;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  vals.forEach((v) => {
    const i = Math.min(bins - 1, Math.floor(((v - min) / span) * bins));
    out[i] += 1;
  });
  return out;
}

function AreaSpark({ id, values, color, height = 26 }: { id: string; values: number[]; color: string; height?: number }) {
  const max = Math.max(1, ...values);
  const w = 100;
  const h = height;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * w;
    const y = h - (v / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DetailButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="secondary-action"
      style={{ color: 'var(--srip-accent-text)', borderColor: 'var(--srip-accent)', background: 'var(--srip-surface)' }}
    >
      {label}
    </Link>
  );
}

function renderAnalysis(
  kind: string,
  rows: any[],
  onSelectNode: (id: string) => void,
  nodeSet: Set<string> | null,
) {
  if (!rows.length) return <Empty>{t('داده‌ای برای این تحلیل یافت نشد.')}</Empty>;
  const nodeName = (x: any) => x?.node?.name ?? x?.node?.displayName ?? x?.node?.label ?? (typeof x?.node === 'string' ? x.node : '—');
  const nodeId = (x: any) => x?.node?.id ?? null;
  const fmt = (v: any) => fmtNum(v);
  const metric = (x: any) =>
    kind === 'centrality' ? ('degree' in x ? x.degree : x.degreeScore)
      : kind === 'bridges' ? ('bridgeScore' in x ? x.bridgeScore : '—')
        : kind === 'bottlenecks' ? ('bottleneckScore' in x ? x.bottleneckScore : '—')
          : ('fragmentationIncrease' in x ? x.fragmentationIncrease : '—');
  const cols =
    kind === 'bottlenecks'
      ? [t('گره') as string, t('گلوگاه') as string, t('ریسک') as string]
      : kind === 'connectors'
        ? [t('گره') as string, t('اتصال‌دهنده') as string, t('نسخه') as string]
        : [t('گره') as string, t('امتیاز') as string];
  const renderNode = (x: any) => {
    const id = nodeId(x);
    const name = nodeName(x);
    if (!id || !nodeSet?.has(id)) return <span>{name}</span>;
    return (
      <button
        onClick={() => onSelectNode(id)}
        title={t('نمایش در گراف')}
        aria-label={`${t('نمایش')} ${name} ${t('در گراف')}`}
        className="net-btn"
        style={{ border: 0, background: 'none', color: 'var(--srip-accent-text)', padding: 0, fontWeight: 800, textAlign: 'right', minHeight: 'auto' }}
      >
        {name}
      </button>
    );
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => {
            const cells: (string | ReactNode)[] =
              kind === 'connectors'
                ? [renderNode(x), fmt(x.connectorScore), x.scoreVersion ?? '—']
                : kind === 'bottlenecks'
                  ? [renderNode(x), fmt(x.bottleneckScore), x.riskyConnections ?? '—']
                  : [renderNode(x), String(metric(x))];
            return (
              <tr key={x?.node?.id ?? i}>
                {cells.map((c, ci) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TAB_LABELS: Record<string, string> = lt( { all: t('همه'), organization: t('شرکت‌ها'), person: t('اشخاص'), project: t('پروژه‌ها') });

export default function Page() {
  const { scopeId, can } = useWorkspace();
  const router = useRouter();
  /* مسترپلن فاز ۲/۱۷: اجازهٔ ساخت/حذف صحنهٔ ارائه */
  const canWriteNetwork = can('publics.write');
  const [graph, setGraph] = useState<GGraph | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('');
  const [pubCat, setPubCat] = useState('');
  const [relType, setRelType] = useState('');
  const [focus, setFocus] = useState('');
  const [mode, setMode] = useState<'shortest' | 'best'>('shortest');
  const [maxHops, setMaxHops] = useState(3);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [path, setPath] = useState<any>(null);
  const [columns, setColumns] = useState<any[] | null>(null);
  const [sna, setSna] = useState<any | null>(null);
  const [predict, setPredict] = useState<any | null>(null);
  // گراف ۴ ستونی: ستون هر پیوند از edgeCategory روی گراف/پیوند می‌آید
  useEffect(() => {
    let alive = true;
    const retry = (tryN = 0) => {
      apiGet<any>('/network/columns')
        .then((d: any) => { if (!alive) return; setColumns(Array.isArray(d) ? d : (d?.columns ?? d?.items ?? [])); })
        .catch(() => { if (alive && tryN < 3) setTimeout(() => retry(tryN + 1), 1200); });
    };
    retry();
    return () => { alive = false; };
  }, []);
  // P2-2: SNA پیشرفته — تراکم/خوشه/PageRank/ایزوله/شکاف ارتباطی + پیشنهاد معرفی
  const loadSna = useCallback(async (tryN = 0) => {
    try { setSna(await apiGet<any>('/network/sna')); }
    catch { if (tryN < 3) setTimeout(() => loadSna(tryN + 1), 1200); }
  }, []);
  useEffect(() => { loadSna(); }, [loadSna]);
  // P3-3: GNN سبک — پیش‌بینی پیوند/خوشه/مسیر گرم
  useEffect(() => {
    let alive = true;
    const retry = (tryN = 0) => {
      apiGet<any>('/network/predict').then((d) => { if (alive) setPredict(d); })
        .catch(() => { if (alive && tryN < 3) setTimeout(() => retry(tryN + 1), 1200); });
    };
    retry();
    return () => { alive = false; };
  }, []);
  /* «پذیرش و پیگیری معرفی»: فرم معرفی را با دادهٔ شکاف باز میکند؛ پس از ثبت،
     معرفی در فهرست معرفیها میآید و همین پیشنهاد در شبکه پذیرفتهشده حساب میشود. */
  const openReferral = (h: any) => {
    const p = new URLSearchParams();
    p.set('new', '1');
    p.set('title', `${t('معرفی')} ${h.viaPerson ?? h.fromOrgName ?? ''} ${t('به')} ${h.toPerson ?? h.toOrgName ?? ''}`);
    const srcPerson = h.viaPersonId ?? '';
    const dstPerson = h.toPersonId ?? '';
    if (srcPerson) { p.set('srcType', 'person'); p.set('src', srcPerson); }
    else { p.set('srcType', 'org'); p.set('src', h.fromOrg ?? ''); }
    if (dstPerson) { p.set('dstType', 'person'); p.set('dst', dstPerson); }
    else { p.set('dstType', 'org'); p.set('dst', h.toOrg ?? ''); }
    p.set('goal', h.reason ?? `${t('برقراری ارتباط میان «')}${h.fromOrgName}${t('» و «')}${h.toOrgName}»`);
    p.set('message', `${t('پیشنهاد شبکه:')} ${h.reason ?? ''}`);
    p.set('suggestion', h.id ?? '');
    router.push(`/referrals?${p.toString()}`);
    log(`${t('باز کردن فرم معرفی برای شکاف «')}${h.fromOrgName}» ↔ «${h.toOrgName}»`);
  };
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisKind, setAnalysisKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [hoverNode, setHoverNode] = useState<GNode | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [renderCounts, setRenderCounts] = useState({ nodes: 0, edges: 0 });
  const [showLegend, setShowLegend] = useState(true);
  const [variant, setVariant] = useState<'nested' | 'classic'>('nested'); /* چیدمان گراف: مرحله‌ای (drill-down) | کلاسیک */
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [graphFs, setGraphFs] = useState(false);
  // تمام‌صفحهٔ گراف: Esc می‌بندد و اسکرول پشت آن قفل می‌شود
  useEffect(() => {
    if (!graphFs) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setGraphFs(false); };
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [graphFs]);
  const [railTab, setRailTab] = useState<'overview' | 'relationships' | 'insights'>('overview');
  const [view, setView] = useState<'overview' | 'analysis' | 'priorities'>('overview');
  const graphHandle = useRef<NetworkGraphHandle | null>(null);

  const [activities, setActivities] = useState<{ t: number; label: string }[]>([]);
  const log = useCallback((label: string) => {
    setActivities((a) => [{ t: Date.now(), label }, ...a].slice(0, 14));
  }, []);

  // Request sequencing + cancellation: only the most recent request may apply its result,
  // and pending requests are aborted on supersession/unmount to avoid stale overwrites and
  // setState-after-unmount (rapid filter/analytics switching, page navigation).
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const beginRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;
    return { seq, signal: controller.signal };
  }, []);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const scopeQuery = useCallback(() => (scopeId !== 'all' ? `organizationId=${encodeURIComponent(scopeId)}` : ''), [scopeId]);

  // روابط واقعی (هم‌محدوده) برای ساخت «توصیه‌های هوشمند» همیشه‌فعال از روی داده
  const [relsList, setRelsList] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<any>(`/relationships${scopeQuery() ? `?${scopeQuery()}` : ''}`)
      .then((d: any) => { if (alive) setRelsList(Array.isArray(d) ? d : (d?.data ?? d?.items ?? [])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (cursor?: string, append = false) => {
    const { seq, signal } = beginRequest();
    try {
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
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const data = await apiGet<GGraph>(`/network/graph?${params.toString()}`, { signal, timeoutMs: 20000 });
      if (seq !== seqRef.current) return;
      setGraph((prev) => {
        if (append && prev) {
          const seenNodeIds = new Set(prev.nodes.map((n) => n.id));
          const newNodes = data.nodes.filter((n) => !seenNodeIds.has(n.id));
          const seenEdgeIds = new Set(prev.edges.map((e) => e.id));
          const newEdges = data.edges.filter((e) => !seenEdgeIds.has(e.id));
          return { ...data, nodes: [...prev.nodes, ...newNodes], edges: [...prev.edges, ...newEdges], meta: data.meta, page: data.page };
        }
        return data;
      });
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || t('بارگذاری شبکه ناموفق بود'));
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [q, type, status, focus, scopeId, beginRequest]);

  useEffect(() => {
    load();
  }, [load]);

  const nodeIds = useMemo(() => new Set(graph?.nodes.map((n) => n.id) ?? []), [graph]);
  const relTypeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const e of graph?.edges ?? []) if ((e.kind === 'relationship' || e.kind === 'person_relationship') && e.label) s.add(e.label);
    return [...s].sort();
  }, [graph]);
  const renderedEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && ((e.kind !== 'relationship' && e.kind !== 'person_relationship') || !relType || e.label === relType)) : []),
    [graph, nodeIds, relType],
  );
  const orphanEdges = graph ? graph.edges.length - renderedEdges.length : 0;
  // Stable graph object for the canvas: rebuilt ONLY when the data actually
  // changes.  Passing an inline object would give NetworkGraph a fresh
  // identity on every page render, forcing its layout memo + onRendered
  // effect to re-run each time (→ unbounded render/effect loop that froze
  // the tab and blocked navigation away from this page).
  /* P3: فیلتر دستهٔ عموم‌ها (سمت کلاینت) — گره‌ها و پیوندهای هم‌راستا */
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    let colored = 0;
    for (const n of graph?.nodes ?? []) {
      if (!n.category) continue;
      colored += 1;
      m.set(n.category, (m.get(n.category) ?? 0) + 1);
    }
    return { byCat: m, colored, total: graph?.nodes?.length ?? 0 };
  }, [graph]);
  const pubCatNodeIds = useMemo(() => {
    if (!pubCat) return null;
    return new Set((graph?.nodes ?? []).filter((n) => n.category === pubCat).map((n) => n.id));
  }, [graph, pubCat]);
  const catFilteredNodes = useMemo(
    () => (pubCatNodeIds ? (graph?.nodes ?? []).filter((n) => pubCatNodeIds.has(n.id)) : graph?.nodes ?? []),
    [graph, pubCatNodeIds],
  );
  const catFilteredEdges = useMemo(
    () => renderedEdges.filter((e) => !pubCatNodeIds || (pubCatNodeIds.has(e.source) && pubCatNodeIds.has(e.target))),
    [renderedEdges, pubCatNodeIds],
  );
  const graphProp = useMemo(
    () => (graph ? { ...graph, nodes: catFilteredNodes, edges: catFilteredEdges } : EMPTY_GRAPH),
    [graph, catFilteredNodes, catFilteredEdges],
  );

  // Status distribution of rendered relationship edges (for chips + legend).
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of renderedEdges) {
      if (e.kind !== 'relationship' && e.kind !== 'person_relationship') continue;
      const s = edgeStatus(e);
      m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [renderedEdges]);
  const hasNext = Boolean(graph?.page?.nextCursor);
  const renderDegrees = useMemo(() => {
    const d = new Map<string, number>();
    renderedEdges.forEach((e) => {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    });
    return d;
  }, [renderedEdges]);

  const selected = selectedNode ?? hoverNode;
  const idToNode = useCallback((id: string) => graph?.nodes.find((n) => n.id === id) ?? null, [graph]);

  const selectedEdge = useMemo(
    () => graph?.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [graph, selectedEdgeId],
  );

  // Path highlight sets (org-level semantics; only highlight nodes/edges present in the loaded graph).
  const pathNodeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.nodes ?? []).forEach((n: any) => s.add(n?.id));
    return s;
  }, [path]);
  const pathEdgeSet = useMemo(() => {
    const s = new Set<string>();
    (path?.edges ?? []).forEach((e: any) => {
      if (!e?.id) return;
      s.add(e.id);                       // real API returns raw relationship ids
      if (!String(e.id).startsWith('e-')) s.add(`e-${e.id}`); // demo SW returns graph ids
    });
    return s;
  }, [path]);

  const analysisList = useMemo(
    () => (Array.isArray(analysis) ? analysis : analysis?.items ?? []),
    [analysis],
  );
  const analysisNodeSet = useMemo(() => {
    const s = new Set<string>();
    analysisList.forEach((r: any) => { if (r?.node?.id) s.add(r.node.id); });
    return s;
  }, [analysisList]);

  // ---- Real, data-derived KPI signals (computed from the loaded graph). ----
  const kpi = useMemo(() => {
    const health = renderedEdges.filter((e) => !(Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD)).length;
    const risk = renderedEdges.filter((e) => Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD).length;
    const opp = renderedEdges.filter((e) => Number.isFinite(e.strategicImportance) && e.strategicImportance >= 60).length;
    const total = renderedEdges.length || 1;
    const degree = new Map<string, number>();
    renderedEdges.forEach((e) => { degree.set(e.source, (degree.get(e.source) ?? 0) + 1); degree.set(e.target, (degree.get(e.target) ?? 0) + 1); });
    const people = (graph?.nodes ?? []).filter((n) => n.type === 'person');
    const influencer = [...people].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0] ?? null;
    const influencerDeg = influencer ? degree.get(influencer.id) ?? 0 : 0;
    return {
      health, risk, opp, total,
      graphHealth: Math.round((health / total) * 100),
      relationshipCount: graph?.meta?.relationshipCount ?? 0,
      personRelationshipCount: graph?.meta?.personRelationshipCount ?? 0,
      peopleCount: graph?.meta?.peopleCount ?? 0,
      influencer, influencerDeg,
    };
  }, [renderedEdges, graph]);

  const activeFilters: { key: string; label: string; onClear: () => void }[] = [];
  if (q) activeFilters.push({ key: 'q', label: `q: ${q}`, onClear: () => setQ('') });
  if (type !== 'all') activeFilters.push({ key: 'type', label: `type: ${type}`, onClear: () => setType('all') });
  if (status) activeFilters.push({ key: 'status', label: `status: ${status}`, onClear: () => setStatus('') });
  if (relType) activeFilters.push({ key: 'relType', label: `${t('نوع رابطه:')} ${relType}`, onClear: () => setRelType('') });
  if (pubCat) activeFilters.push({ key: 'pubCat', label: `${t('دستهٔ عموم‌ها:')} ${PUBLIC_CATEGORY_META[pubCat]?.fa ?? pubCat}`, onClear: () => setPubCat('') });
  if (focus) {
    const focusNode = graph?.nodes.find((n) => n.id === focus);
    activeFilters.push({ key: 'focus', label: `focus: ${focusNode ? nodeDisplayName(focusNode) : focus}`, onClear: () => setFocus('') });
  }

  const runPathFor = async (fromId: string, toId: string) => {
    if (!fromId || !toId) return;
    const { seq, signal } = beginRequest();
    setError('');
    log(`${t('درخواست مسیر سازمانی:')} ${faEntityId(fromId)} ← ${faEntityId(toId)}`);
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/path?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}&mode=${mode}&maxHops=${maxHops}${sq ? `&${sq}` : ''}`, { signal, timeoutMs: 15000 });
      if (seq === seqRef.current) setPath(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || t('محاسبهٔ مسیر ناموفق بود'));
    }
  };
  const runPath = () => { if (from && to) runPathFor(from, to); };
  const clearPath = () => { setPath(null); log(t('مسیر پاک شد')); };
  // انتخاب سریع مبدأ/مقصد از روی خود گراف (کارت شناور گره) — با اجرای خودکار
  const setPathEnd = (node: GNode, end: 'from' | 'to') => {
    const id = node.id;
    if (end === 'from') {
      setFrom(id);
      if (to && to !== id) runPathFor(id, to);
    } else {
      setTo(id);
      if (from && from !== id) runPathFor(from, id);
    }
    log(end === 'from' ? `${t('مبدأ مسیر:')} ${nodeDisplayName(node)}` : `${t('مقصد مسیر:')} ${nodeDisplayName(node)}`);
  };
  // گام پیشنهادی در فقدان مسیر: مسیر تا گام میانی را نشان بده
  const goStep = (sg: any) => {
    if (!sg?.viaOrg) return;
    const target = `org:${sg.viaOrg}`;
    setTo(target);
    runPathFor(from, target);
    log(`${t('گام پیشنهادی: نمایش مسیر تا')} ${sg.viaOrgName ?? faEntityId(sg.viaOrg)}`);
  };
  const openNodePage = (href: string) => { router.push(href); };
  const loadConnectors = async () => {
    const { seq, signal } = beginRequest();
    setError('');
    setAnalysisKind('connectors');
    log(t('اجرای تحلیل: اتصال‌دهنده‌ها'));
    setShowAnalysis(true);
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/connectors${sq ? `?${sq}` : ''}`, { signal });
      if (seq === seqRef.current) setAnalysis(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || t('بارگذاری اتصال‌دهنده‌ها ناموفق بود'));
    }
  };
  const runAnalysis = async (endpoint: string) => {
    const { seq, signal } = beginRequest();
    setError('');
    setAnalysisKind(endpoint);
    log(`${t('اجرای تحلیل:')} ${ANALYSIS_FA[endpoint] ?? t('شبکه')}`);
    setShowAnalysis(true);
    try {
      const sq = scopeQuery();
      const result = await apiGet(`/network/${endpoint}${sq ? `?${sq}` : ''}`, { signal });
      if (seq === seqRef.current) setAnalysis(result);
    } catch (e: any) {
      if (seq !== seqRef.current || e?.name === 'AbortError') return;
      setError(e?.message || t('بارگذاری تحلیل ناموفق بود'));
    }
  };
  const onRendered = useCallback((counts: { nodes: number; edges: number }) => setRenderCounts(counts), []);
  const loadMore = async () => {
    if (!graph?.page?.nextCursor) return;
    log(t('بارگذاری صفحه بعدی گراف'));
    await load(graph.page.nextCursor, true);
  };

  // Neighbor expansion: reuse the backend focus capability and reload.
  const expandNode = (node: GNode) => {
    setSelectedNode(node);
    if (focus !== node.id) setFocus(node.id);
    log(`${t('گسترش همسایه‌ها:')} ${nodeDisplayName(node)}`);
  };
  const clearFocus = () => {
    setFocus('');
    setSelectedNode(null);
  };

  // Analytics row click: highlight the node in the graph by selecting it.
  const selectAnalyticsNode = (id: string) => {
    const node = graph?.nodes.find((n) => n.id === id) ?? null;
    setSelectedNode(node);
    setRailTab('overview');
    setView('overview');
  };

  const onNodeSelect = useCallback((n: GNode | null) => {
    setSelectedNode(n);
    setRailTab('overview');
    if (n) setSelectedEdgeId(null);
  }, []);

  const orgNodes = graph ? graph.nodes.filter((n) => n.type === 'organization') : [];

  // ---- Priorities (top real risk edges) ----
  const riskPriorities = useMemo(
    () => renderedEdges
      .filter((e) => Number.isFinite(e.risk))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5),
    [renderedEdges],
  );

  // ---- توصیه‌های هوشمند: همیشه‌فعال و مبتنی بر دادهٔ واقعی (روابط + امتیازها +
  //      سیگنال‌های ریسک). نتایج تحلیل‌های شبکه هم هنگام اجرا به آن افزوده می‌شوند.
  const ANALYSIS_FA: Record<string, string> = { centrality: t('مرکزیت'), connectors: t('اتصال‌دهنده‌ها'), bridges: t('افراد پل'), bottlenecks: t('گلوگاه‌ها'), 'single-points-of-failure': t('نقاط تک‌خطا') };
  const recommendations = useMemo(() => {
    type Rec = { text: string; sub: string | null; tone: 'danger' | 'warning' | 'success' | 'info'; href: string | null };
    const out: Rec[] = [];
    const relName = (r: any) => [r?.sourceOrganization?.name, r?.targetOrganization?.name].filter(Boolean).join(' ↔ ') || r?.id || '';
    const risky = (relsList as any[])
      .filter((r: any) => (r.riskScore ?? 0) >= 40 || (r.healthScore ?? 100) < 55 || r.status === 'WATCH' || r.status === 'AT_RISK')
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 4);
    for (const r of risky) {
      const name = relName(r);
      const drivers: Array<{ label: string; detail: string; tone: string }> = r.riskDrivers ?? [];
      const has = (t: string) => drivers.some((d) => d.label.includes(t));
      const det = (t: string) => drivers.find((d) => d.label.includes(t))?.detail ?? null;
      const link = `/relationships/${r.id}`;
      if (has(t('اقدام عقب‌افتاده')))
        out.push({ text: `${t('اقدامِ عقب‌افتادهٔ «')}${name}${t('» را پیگیری کنید')}`, sub: det('اقدام عقب‌افتاده'), tone: 'danger', href: link });
      else if (has(t('بدون اقدام اصلاحی باز')))
        out.push({ text: `${t('برای «')}${name}${t('» اقدام اصلاحی ثبت کنید')}`, sub: det('بدون اقدام اصلاحی باز') ?? `${t('دلایل:')} ${drivers.slice(0, 2).map((d) => d.label).join(t('،'))}`, tone: 'warning', href: link });
      else if (has(t('قدمِ برنامه‌ریزی‌شده عقب افتاده')))
        out.push({ text: `${t('قدم بعدی «')}${name}${t('» را به‌روزرسانی کنید')}`, sub: det('قدمِ برنامه‌ریزی‌شده عقب افتاده'), tone: 'warning', href: link });
      else if (has(t('رکود تعامل')) || has(t('فاصلهٔ طولانی')))
        out.push({ text: `${t('تعامل تازه‌ای با «')}${name}${t('» برنامه‌ریزی کنید')}`, sub: det('رکود تعامل') ?? det('فاصلهٔ طولانی'), tone: 'warning', href: link });
      else if ((r.riskScore ?? 0) >= 60)
        out.push({ text: `${t('ریسک «')}${name}${t('» بالاست — بررسی فوری کنید')}`, sub: `${t('ریسک')} ${r.riskScore} ${t('· سلامت')} ${r.healthScore}`, tone: 'danger', href: link });
    }
    if (out.length < 4) {
      const opp = (relsList as any[])
        .filter((r: any) => (r.strategicScore ?? 0) >= 80 && (r.riskScore ?? 0) < 40 && (r.status ?? '') !== 'WATCH')
        .sort((a, b) => (b.strategicScore ?? 0) - (a.strategicScore ?? 0))[0];
      if (opp) out.push({ text: `${t('مسیر پیشبرد «')}${relName(opp)}${t('» را فعال کنید')}`, sub: `${t('ارزش راهبردی')} ${opp.strategicScore} ${t('— کاندیدای ایده‌آل برای سرمایه‌گذاری رابطه')}`, tone: 'success', href: `/relationships/${opp.id}` });
    }
    if (analysisKind && analysisList.length) {
      analysisList.slice(0, 2).forEach((r: any) => {
        const name = nodeDisplayName(r?.node);
        let text: string; let tone: 'danger' | 'warning' | 'success' | 'info';
        if (analysisKind === 'connectors') { text = `${name} ${t('ارتباط‌دهندهٔ کلیدی است؛ مسیرهای بین‌سازمانی را حول او تقویت کنید.')}`; tone = 'success'; }
        else if (analysisKind === 'centrality') { text = `${name} ${t('با درجه')} ${r.degree} ${t('بیشترین تأثیر را در شبکه دارد.')}`; tone = 'info'; }
        else if (analysisKind === 'bridges') { text = `${name} ${t('به')} ${r.bridgeScore} ${t('سازمان پل می‌زند؛ همکاری او را پایش کنید.')}`; tone = 'info'; }
        else if (analysisKind === 'bottlenecks') { text = `${name} ${t('نقطهٔ گلوگاه است (')}${r.bottleneckScore}${t(')؛ وابستگی را تنوع ببخشید.')}`; tone = 'warning'; }
        else { text = `${t('حذف')} ${name} ${t('شبکه را به')} ${r.fragmentationIncrease} ${t('مؤلفه می‌شکند؛ ریسک تک‌نقطه دارد.')}`; tone = 'warning'; }
        out.push({ text, sub: `${t('بر پایهٔ تحلیل')} ${ANALYSIS_FA[analysisKind] ?? analysisKind}`, tone, href: null });
      });
    }
    if (!out.length) out.push({ text: t('وضعیت شبکهٔ شما نسبتاً سالم است؛ رابطهٔ پرریسکی بدون پوشش نیست.'), sub: null, tone: 'success', href: null });
    return out.slice(0, 6);
  }, [analysisKind, analysisList, relsList]);

  // ---- Node/edge rail data ----
  const railRelationships = useMemo(() => {
    if (!selectedNode) return [];
    return renderedEdges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .sort((a, b) => (b.strategicImportance ?? 0) - (a.strategicImportance ?? 0));
  }, [selectedNode, renderedEdges]);

  const railNodeDegree = railRelationships.length;
  const railNodeRisky = railRelationships.filter((e) => Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD).length;
  const railNodeTopRel = railRelationships[0] ?? null;

  const derivedInsights: string[] = [];
  if (kpi.risk > 0) derivedInsights.push(`${fmtNum(kpi.risk)} ${t('رابطه پرریسک (ریسک ≥')} ${fmtNum(RISK_THRESHOLD)}${t(') در گراف بارگذاری‌شده شناسایی شد.')}`);
  if (kpi.opp > 0) derivedInsights.push(`${fmtNum(kpi.opp)} ${t('رابطه راهبردی (امتیاز راهبردی ≥ ۶۰) فرصت بالقوه در نظر گرفته می‌شود.')}`);
  if (kpi.influencer) derivedInsights.push(`${nodeDisplayName(kpi.influencer)} ${t('با')} ${fmtNum(kpi.influencerDeg)} ${t('پیوند، تأثیرگذارترین شخص در گراف بارگذاری‌شده است.')}`);
  if (path?.found) derivedInsights.push(`${t('مسیر کوتاه/بهینه سازمانی با')} ${fmtNum(path.hops)} ${t('پرش یافت شد.')}`);
  if (path && !path.found) derivedInsights.push(`${t('مسیر سازمانی بین دو گره انتخاب‌شده یافت نشد.')}`);
  if (!derivedInsights.length) derivedInsights.push(t('هنوز الگوی قابل‌توجهی از گراف بارگذاری‌شده استخراج نشده است.'));

  function selectEdge(id: string) {
    setSelectedEdgeId(id);
    setSelectedNode(null);
    setRailTab('overview');
  }

  return (
    <main className="net-page">
      <ErrorCard message={error} />
      {loading ? <Loading /> : null}

      {/* Header */}
      <section className="net-head">
        <div>
          <h1>{t('شبکهٔ روابط')}</h1>
          <p className="subtitle">
            {t('گراف تعاملی روابط استراتژیک با فیلتر، مسیر و تحلیل ریسک/تأثیرگذاری. همهٔ مقادیر از دادهٔ واقعیِ همان محدودهٔ سازمانی محاسبه می‌شوند.')}
          </p>
          <div className="net-stats-line">
            <span><b>{fmtNum(graph?.meta?.organizationCount ?? 0)}</b> {t('سازمان')}</span>
            <span><b>{fmtNum(graph?.meta?.peopleCount ?? 0)}</b> {t('شخص')}</span>
            <span><b>{fmtNum(graph?.meta?.projectCount ?? 0)}</b> {t('پروژه')}</span>
            <span><b>{fmtNum(graph?.meta?.relationshipCount ?? 0)}</b> {t('رابطه سازمانی')}</span>
            <span><b>{fmtNum(graph?.meta?.personRelationshipCount ?? 0)}</b> {t('رابطه شخص')}</span>
            <span><b>{fmtNum(renderCounts.nodes)}</b> {t('گره رندر شده ·')} <b>{fmtNum(renderCounts.edges)}</b> {t('پیوند رندر شده')}</span>
            <span title={t('گره‌های دارای برچسب دستهٔ عموم‌ها در نقشه')}><b data-categorized-count={catCounts.colored}>{fmtNum(catCounts.colored)}</b> {t('گرهٔ دسته‌بندی‌شده')}</span>
            {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}>{fmtNum(orphanEdges)} پیوند یتیم حذف شد</span> : null}
            {scopeId !== 'all' ? <span className="scope-badge">محدوده: {faEntityId(scopeId)}</span> : null}
          </div>
        </div>
        <div className="net-tabs" role="tablist" aria-label={t('فیلتر بر اساس نوع گره')}>
          {Object.entries(TAB_LABELS).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={type === k}
              className={`tab ${type === k ? 'active' : ''}`}
              onClick={() => { setType(k); log(`${t('فیلتر نوع:')} ${label}`); }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* منوی داخلی صفحه (v6) — صفحه را کوتاه و قابل‌پیمایش می‌کند */}
      <nav className="net-nav" role="tablist" aria-label={t('بخش‌های صفحهٔ شبکه روابط')}>
        {([
          ['overview', t('نمای کلی'), Network],
          ['analysis', t('تحلیل و بینش'), BrainCircuit],
          ['priorities', t('اولویت‌ها و توصیه‌ها'), Target],
        ] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            className={`net-nav-tab ${view === k ? 'active' : ''}`}
            onClick={() => { if (view !== k) log(`${t('بخش:')} ${label}`); setView(k); }}
          >
            <Icon size={14} /> <span>{label}</span>
          </button>
        ))}
      </nav>

      {view === 'analysis' && (
        <>
      {/* 4-column network (P1-6): edgeCategory from /network/columns */}
      {columns && columns.length > 0 && (
        <section className="panel" style={{ margin: 0, marginBottom: 14 }} aria-label={t('ستون‌های شبکه')}>
          <div className="panel-title">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Network size={16} /> {t('شبکهٔ چهارستونی')}</h2>
              <p>{t('ستون هر پیوند روی گراف از نوع سازمان مبدأ/مقصد تعیین می‌شود — برای پیمایش مسیر «داخل تیم ← مشتری ← هیئت» و حاکمیت معرف.')}</p>
            </div>
            <Badge tone="info">{columns.length} ستون</Badge>
          </div>
          <div className="attr-grid">
            {columns.map((c: any) => (
              <div key={c.key} className="kpi-card" style={{ margin: 0 }}>
                <small>{COLUMN_LABELS[c.key] ?? c.key}</small>
                <strong>{fmtNum(c.nodeCount)} گره · {fmtNum(c.edgeCount)} پیوند</strong>
                <span className="t-muted" style={{ fontSize: 11 }}>{COLUMN_LABELS[c.key] ?? t('ستون')} — {c.edges?.length ? t('حاضر در گراف') : t('ستون خالی')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* P2-2: SNA پیشرفته */}
      {sna && (
        <section className="panel" style={{ margin: 0, marginBottom: 14 }} aria-label={t('تحلیل پیشرفته شبکه')}>
          <div className="panel-title">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Layers size={16} /> {t('تحلیل پیشرفتهٔ شبکه')}</h2>
              <p>{t('تراکم، خوشه‌ها، رتبهٔ مرکزیت گره‌ها، گره‌های منفرد و شکاف‌های ارتباطی — خروجی کاملاً قطعی از پیوند‌های همین گراف')}</p>
            </div>
            <Badge tone="info">تراکم سازمانی {fmtNum(sna.kpis?.densityOrg)}٪ · {fmtNum(sna.kpis?.componentCount)} مؤلفه</Badge>
          </div>
          <div className="kpi-grid" style={{ marginBottom: 10 }}>
            <div className="kpi-card" style={{ margin: 0 }}><small>{t('تراکم (سازمانی)')}</small><strong>{fmtNum(sna.kpis?.densityOrg)}٪</strong></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>{t('تراکم کل گراف')}</small><strong>{fmtNum(sna.kpis?.densityFull)}٪</strong></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>{t('گره‌های منفرد')}</small><strong>{fmtNum(sna.kpis?.isolatedCount)}</strong></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>{t('پیوند پیشنهادی')}</small><strong>{fmtNum(sna.kpis?.proposedEdges)}</strong></div>
            <div className="kpi-card" style={{ margin: 0 }}><small>{t('پذیرفته‌شده')}</small><strong>{fmtNum(sna.kpis?.acceptedEdges)}</strong></div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(sna.isolates ?? []).map((x: any) => (
              <span key={x.node?.id} className="chip danger">منفرد: {x.node?.label}</span>
            ))}
            {(sna.clusters ?? []).map((c: any, i: number) => (
              <span key={c.id} className="chip neutral" title={c.nodes.map((n: any) => n.label).slice(0, 8).join(t('،'))}>
                خوشهٔ {i + 1} ({fmtNum(c.size)} گره)
              </span>
            ))}
            {(sna.pageRank ?? []).slice(0, 4).map((x: any) => (
              <span key={x.node?.id} className="chip" title={t('مرکزیت PageRank')}>رتبهٔ مرکزیت {x.node?.label}: {fmtNum(x.score)}</span>
            ))}
          </div>
          {(sna.structuralHoles ?? []).length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
              <b style={{ fontSize: 12 }}>{t('پیشنهاد معرفی (اتصال شکاف‌های ارتباطی)')}</b>
              {(sna.structuralHoles ?? []).map((h: any) => (
                <div key={h.id} className="wf-alert" role="note" style={{ alignItems: 'center' }}>
                  <UserPlus size={14} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12 }}>{h.fromOrgName} ↔ {h.toOrgName}</b>
                    <small className="t-muted" style={{ display: 'block' }}>{h.reason}</small>
                  </span>
                  {h.expectedValue > 0 && <span className="chip info">{fmtNum(h.expectedValue / 1e9)} میلیارد تومان</span>}
                  <button className="btn btn-primary" style={{ minHeight: 0, padding: '5px 12px', fontSize: 12 }}
                    onClick={() => openReferral(h)} title={t('باز کردن فرم معرفی با دادهٔ این شکاف')}>
                    <UserPlus size={12} style={{ verticalAlign: '-2px', marginInlineEnd: 4 }} />
                    {t('پذیرش و پیگیری معرفی')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* P3-3: GNN سبک — پیش‌بینی */}
      {predict && (
        <section className="panel" style={{ margin: 0, marginBottom: 14 }} aria-label={t('پیش‌بینی شبکه')}>
          <div className="panel-title">
            <div>
              <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><BrainCircuit size={16} /> {t('پیش‌بینی شبکه (مدل سبک)')}</h2>
              <p>{t('پیش‌بینی پیوند بین سازمان‌های بی‌رابطه، خوشه‌های گراف و مسیر مطمئن به فرصت‌های باز — همه از روی داده‌های همان شبکه محاسبه شده‌اند')}</p>
            </div>
            <div className="toolbar">
              <Badge tone="info">{fmtNum(predict.kpis?.predictedLinks)} پیوند پیش‌بینی‌شده</Badge>
              <Badge tone={predict.kpis?.warmPaths ? 'success' : 'neutral'}>{fmtNum(predict.kpis?.warmPaths)} مسیر مطمئن</Badge>
            </div>
          </div>
          <div className="attr-grid">
            {(predict.predictedLinks ?? []).map((l: any) => (
              <div key={l.id} className="kpi-card" style={{ margin: 0 }}>
                <small>{l.fromOrgName} ↔ {l.toOrgName}</small>
                <strong>{fmtNum(l.score)}</strong>
                <span className="t-muted" style={{ fontSize: 11 }}>{(l.reason ?? []).join(' · ')}</span>
              </div>
            ))}
          </div>
          {(predict.warmPaths ?? []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <b style={{ fontSize: 12 }}>{t('مسیر مطمئن به فرصت‌های باز')}</b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {(predict.warmPaths ?? []).map((w: any) => (
                  <span key={w.organizationId} className={w.found ? 'chip success' : 'chip danger'} title={w.path?.join(' ← ') ?? ''}>
                    {w.organizationName}: {w.found ? `${w.hops} ${t('پرش · امتیاز')} ${w.score}` : t('مسیری در ۳ پرش نیست')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {/* Full analysis sheet */}
      {showAnalysis && (
        <section className="card analysis-sheet">
          <div className="net-detail-tabs" style={{ padding: '0 0 8px', background: 'none' }}>
            <button className={analysisKind === 'centrality' ? 'active' : ''} onClick={() => runAnalysis('centrality')}>{t('مرکزیت')}</button>
            <button className={analysisKind === 'connectors' ? 'active' : ''} onClick={loadConnectors}>{t('اتصال‌دهنده‌ها')}</button>
            <button className={analysisKind === 'bridges' ? 'active' : ''} onClick={() => runAnalysis('bridges')}>{t('افراد پل')}</button>
            <button className={analysisKind === 'bottlenecks' ? 'active' : ''} onClick={() => runAnalysis('bottlenecks')}>{t('گلوگاه‌ها')}</button>
            <button className={analysisKind === 'single-points-of-failure' ? 'active' : ''} onClick={() => runAnalysis('single-points-of-failure')}>{t('نقاط تک‌خطا')}</button>
          </div>
          <p className="muted">{t('روی هر نتیجه کلیک کنید تا همان گره در گراف انتخاب شود.')}</p>
          {analysis ? (
            <div className="table-wrap">
              {renderAnalysis(analysisKind || 'centrality', analysisList, selectAnalyticsNode, analysisNodeSet)}
            </div>
          ) : <Empty>{t('برای نمایش تحلیل کامل، یکی از دکمه‌های بالا را اجرا کنید.')}</Empty>}
        </section>
      )}
        </>
      )}

      {view === 'overview' && (
        <>
      {/* Stats row */}
      <section className="stats-row" aria-label={t('شاخص‌های کلیدی شبکه')}>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-teal"><ShieldCheck size={14}/></span><span className="st-name">{t('سلامت شبکه')}</span></div>
          <strong className="st-value">{fmtNum(kpi.graphHealth)}٪</strong>
          <AreaSpark id="sp-health" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD ? 0 : 100)))} color="var(--teal)" />
          <div className="st-foot"><span className="st-delta up">{fmtNum(kpi.health)} کم‌خطر</span><span className="st-note">نسبت به {fmtNum(kpi.total)} پیوند</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue"><Network size={14}/></span><span className="st-name">{t('کل روابط')}</span></div>
          <strong className="st-value">{fmtNum(kpi.relationshipCount)}</strong>
          <AreaSpark id="sp-rel" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--blue)" />
          <div className="st-foot"><span className="st-delta">{fmtNum(kpi.personRelationshipCount)} شخص</span><span className="st-note">{fmtNum(renderedEdges.length)} پیوند رندر</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-indigo"><Lightbulb size={14}/></span><span className="st-name">{t('فرصت‌ها')}</span></div>
          <strong className="st-value">{fmtNum(kpi.opp)}</strong>
          <AreaSpark id="sp-opp" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.strategicImportance) ? e.strategicImportance : 0)))} color="var(--indigo)" />
          <div className="st-foot"><span className="st-delta up">{fmtNum(kpi.total ? Math.round((kpi.opp / kpi.total) * 100) : 0)}٪</span><span className="st-note">{t('اهمیت راهبردی ≥ ۶۰')}</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-red"><AlertTriangle size={14}/></span><span className="st-name">{t('در معرض ریسک')}</span></div>
          <strong className="st-value">{fmtNum(kpi.risk)}</strong>
          <AreaSpark id="sp-risk" values={bucketize(renderedEdges.map((e) => (Number.isFinite(e.risk) ? e.risk : 0)))} color="var(--red)" />
          <div className="st-foot"><span className="st-delta down">{fmtNum(kpi.total ? Math.round((kpi.risk / kpi.total) * 100) : 0)}٪</span><span className="st-note">ریسک ≥ {fmtNum(RISK_THRESHOLD)}</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold"><Zap size={14}/></span><span className="st-name">{t('تأثیرگذاری')}</span></div>
          <strong className="st-value">{fmtNum(kpi.influencerDeg)}</strong>
          <AreaSpark id="sp-inf" values={bucketize((graph?.nodes ?? []).map((n) => renderDegrees.get(n.id) ?? 0))} color="var(--gold)" />
          <div className="st-foot"><span className="st-delta">{kpi.influencer ? nodeDisplayName(kpi.influencer) : '—'}</span><span className="st-note">{t('پیوندها')}</span></div>
        </div>
      </section>

      {/* Filters */}
      <section className="net-filters">
        <input
          type="search"
          aria-label={t('جستجو در شبکه')}
          placeholder={t('جستجوی سازمان، شخص یا پروژه…')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { load(); log(t('جستجو اعمال شد')); } }}
        />
        <div className="status-chips" role="group" aria-label={t('فیلتر وضعیت رابطه')}>
          <button
            className={`status-chip ${status === '' ? 'active' : ''}`}
            onClick={() => { setStatus(''); log(t('فیلتر وضعیت: همه')); }}
          >
            {t('همه')}
            <span className="status-count">{fmtNum(statusCounts.size ? [...statusCounts.values()].reduce((a, b) => a + b, 0) : 0)}</span>
          </button>
          {STATUSES.map((s) => {
            const meta = statusMeta(s);
            const cnt = statusCounts.get(s) ?? 0;
            const active = status === s;
            return (
              <button
                key={s}
                className={`status-chip ${active ? 'active' : ''}`}
                style={active ? { background: meta.color, borderColor: meta.color } : { color: meta.color }}
                onClick={() => { setStatus(active ? '' : s); log(`${t('فیلتر وضعیت:')} ${meta.label}`); }}
                disabled={!cnt}
                title={cnt ? `${meta.label} — ${fmtNum(cnt)} ${t('رابطه')}` : `${t('هیچ رابطه‌ای با وضعیت')} ${meta.label} ${t('نیست')}`}
              >
                <span className="status-dot" style={{ background: meta.color }} />
                {meta.label}
                <span className="status-count">{fmtNum(cnt)}</span>
              </button>
            );
          })}
        </div>
        <div className="status-chips" role="group" aria-label={t('فیلتر دستهٔ عموم‌ها')}>
          <button
            className={`status-chip ${pubCat === '' ? 'active' : ''}`}
            data-cat=""
            onClick={() => { setPubCat(''); log(t('فیلتر دستهٔ عموم‌ها: همه')); }}
          >
            {t('همهٔ دسته‌ها')}
            <span className="status-count">{fmtNum(catCounts.colored)}</span>
          </button>
          {PUBLIC_CATEGORY_ORDER.map((k) => {
            const meta = PUBLIC_CATEGORY_META[k];
            const cnt = catCounts.byCat.get(k) ?? 0;
            const active = pubCat === k;
            return (
              <button
                key={k}
                className={`status-chip ${active ? 'active' : ''}`}
                data-cat={k}
                data-count={cnt}
                style={active ? { background: meta.color, borderColor: meta.color } : { color: meta.color }}
                onClick={() => { setPubCat(active ? '' : k); log(`${t('فیلتر دستهٔ عموم‌ها:')} ${meta.fa}`); }}
                title={cnt ? `${meta.fa} — ${fmtNum(cnt)} ${t('گره')}` : `${t('هنوز گره‌ای در دستهٔ')} ${meta.fa} ${t('نیست')}`}
              >
                <span className="status-dot" style={{ background: meta.color }} />
                {meta.fa}
                <span className="status-count">{fmtNum(cnt)}</span>
              </button>
            );
          })}
          <span className="lg" style={{ alignItems: 'center' }} title={t('گرهٔ خودِ شرکت')}>
            <span className="sw" style={{ background: `repeating-linear-gradient(45deg, ${EGO_COLOR} 0 3px, #fff 3px 6px)`, borderRadius: 4 }} />
            {EGO_FA}
          </span>
        </div>
        <select aria-label={t('نوع رابطه')} value={relType} onChange={(e) => setRelType(e.target.value)}>
          <option value="">{t('همه انواع رابطه')}</option>
          {relTypeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select aria-label={t('گره کانونی')} value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="">{t('بدون کانون')}</option>
          {graph?.nodes.map((n) => (
            <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
          ))}
        </select>
        <button className="net-btn primary" onClick={() => { load(); log(t('فیلترها اعمال شد')); }} disabled={loading}>
          {t('اعمال فیلترها')}
        </button>
        <button className="net-btn" onClick={loadMore} disabled={loadingMore || !hasNext}>
          {loadingMore ? t('در حال بارگذاری…') : hasNext ? t('بارگذاری بیشتر') : t('همه بارگذاری شد')}
        </button>
        {activeFilters.length > 0 && (
          <div className="active-filters">
            <small>{t('فیلترهای فعال:')}</small>
            {activeFilters.map((f) => (
              <span className="filter-chip" key={f.key}>
                {f.label}
                <button onClick={f.onClear} aria-label={`Clear filter ${f.label}`}>✕</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Workspace: graph + detail rail */}
      <div className="content-grid">
        <div className="content-main">
          <div className="panels-row">
        <div className="net-graph-shell">
          <div className="net-graph-head">
            <div>
              <h2>{t('شبکهٔ خوشه‌ای ارتباطات')}</h2>
              <div className="counts">
                <b>{fmtNum(renderCounts.nodes)}</b> {t('گره نمایش داده شده ·')} <b>{fmtNum(renderCounts.edges)}</b> پیوند
                {orphanEdges > 0 ? <span style={{ color: 'var(--srip-danger)' }}> · {fmtNum(orphanEdges)} پیوندِ نامرتبط حذف شد</span> : null}
              </div>
            </div>
            <div className="net-graph-toolbar">
              <span className="net-pinch-hint" title={t('چیدمان گراف: مرحله‌ای (شبکهٔ شرکت → مرحله به مرحله) یا کلاسیک (همهٔ سازمان‌ها)')}><Layers size={12}/> {t('چیدمان:')}</span>
              <button className={`net-btn ${variant === 'nested' ? 'primary' : ''}`} onClick={() => { setVariant('nested'); log(t('چیدمان مرحله‌ای')); }} title={t('خودِ شرکت در مرکز؛ کلیک روی هر سازمان = زیرمجموعه‌ها و روابط آن')}>{t('مرحله‌ای')}</button>
              <button className={`net-btn ${variant === 'classic' ? 'primary' : ''}`} onClick={() => { setVariant('classic'); log(t('چیدمان کلاسیک')); }} title={t('همهٔ سازمان‌ها به‌صورت خوشه‌ای کامل')}>{t('کلاسیک')}</button>
              <button className="net-btn" onClick={() => graphHandle.current?.fit()} disabled={!graph} title={t('متناسب با نما')}><Maximize size={12}/> {t('متناسب')}</button>
              <button className="net-btn" onClick={() => graphHandle.current?.reset()} disabled={!graph} title={t('بازنشانی')}>{t('بازنشانی')}</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(1.35)} disabled={!graph} title={t('بزرگ‌نمایی')} aria-label={t('بزرگ‌نمایی')}>+</button>
              <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(0.74)} disabled={!graph} title={t('کوچک‌نمایی')} aria-label={t('کوچک‌نمایی')}>−</button>
              <span className="net-pinch-hint" title={t('روی موبایل با دو انگشت زوم کنید؛ دوباره‌لمس روی زمینه هم بزرگ‌نمایی می‌کند')}><Maximize size={12} /> دو انگشت = زوم</span>
              <button className="net-btn" onClick={() => setShowLegend(!showLegend)} title={t('نمایش/عدم نمایش راهنما')}>{t('راهنما')}</button>
              {focus ? <button className="net-btn" onClick={clearFocus} title={t('بازگشت به نمای کلی')}>{t('پاک‌کردن تمرکز')}</button> : null}
              <button className="net-btn primary" onClick={() => setGraphFs(true)} disabled={!graph} title={t('نمایش تمام‌صفحهٔ گراف')}><Maximize2 size={13}/> {t('تمام صفحه')}</button>
              <PresentationMode graph={graph} currentFocus={focus} currentVariant={variant} canWrite={canWriteNetwork} />
            </div>
          </div>

          {/* Path tool */}
          <div className="net-path-tool">
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--srip-text-2)' }}>{t('مسیر سازمانی')}</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t('مبدأ مسیر')}>
              <option value="">{t('از')}</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label={t('مقصد مسیر')}>
              <option value="">{t('تا')}</option>
              {orgNodes.map((n) => (
                <option key={n.id} value={n.id}>{nodeDisplayName(n)}</option>
              ))}
            </select>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label={t('حالت مسیر')}>
              <option value="shortest">{t('کوتاه‌ترین')}</option>
              <option value="best">{t('بهترین')}</option>
            </select>
            <select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))} aria-label={t('حداکثر پرش')}>
              {[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>تا {h} پرش</option>)}
            </select>
            <button className="net-btn primary" onClick={runPath} disabled={!from || !to}>{t('یافتن مسیر')}</button>
            {path ? <button className="net-btn" onClick={clearPath}>{t('پاک‌کردن مسیر')}</button> : null}
          </div>
          {path && (
            <div className={`net-path-result ${path.found ? 'found' : 'notfound'}`}>
              <div className="net-path-msg">
                {path.found
                  ? `${t('مسیر سازمانی یافت شد:')} ${fmtNum(path.hops)} ${t('پرش · هزینه')} ${fmtNum(path.totalCost) ?? '—'} ${t('· امتیاز مسیر')} ${fmtNum(path.score) ?? '—'} (${path.scoreLabel ?? '—'}${t(') · بقیهٔ گراف کمرنگ می‌شود.')}`
                  : t('مسیر سازمانی بین این دو گره یافت نشد — در دادهٔ فعلی به هم متصل نیستند (سازمان دیگری بین آن‌ها نیست).')}
              </div>
              {path.found && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <span className="chip info">کپ مسیر: {path.capped ? `${path.maxHops} ${t('پرش')}` : t('کامل')}</span>
                  <span className="chip">ظرفیت معرف در ۳۰ روز: {fmtNum(path.governance?.capacityPer30Days ?? 1)}</span>
                  <span className={path.governance?.allowed ? 'chip success' : 'chip danger'}>
                    {path.governance?.allowed ? t('حاکمیت معرف: مجاز') : t('حاکمیت معرف: مسدود')}
                  </span>
                  {Array.isArray(path.governance?.loads) && path.governance.loads.length > 0 && (
                    <span className="chip neutral" title={path.governance.loads.map((l: any) => `${faEntityId(l.personId)}: ${fmtNum(l.load)}/${fmtNum(l.capacity)}`).join(' · ')}>
                      بار معرف‌ها: {path.governance.loads.map((l: any) => `${faEntityId(l.personId)} ${fmtNum(l.load)}/${fmtNum(l.capacity)}`).join(' · ')}
                    </span>
                  )}
                </div>
              )}
              {path.found && Array.isArray(path.nodes) && path.nodes.length > 1 && (
                <div className="net-path-chain">
                  {path.nodes.map((n: any, i: number) => (
                    <span key={n?.id ?? i} className="pc">
                      {i > 0 ? <i className="pc-arrow">←</i> : null}
                      {n?.label ?? n?.name ?? '—'}
                    </span>
                  ))}
                  <span className="pc-arrow">←</span>
                  <b className="pc pc-hops">{fmtNum(path.hops)} پرش</b>
                </div>
              )}
              {/* پیشنهادها: مسیری یافت نشد → مسیرهای برقراری ارتباط */}
              {!path.found && Array.isArray(path.suggestions) && path.suggestions.length > 0 && (
                <div className="npf-block npf-suggest">
                  <div className="npf-title">{t('مسیرهای پیشنهادی برای برقراری این ارتباط')}</div>
                  {path.suggestions.map((sg: any) => (
                    <div className={`npf-card sg-${String(sg.kind ?? '').toLowerCase()}`} key={sg.id}>
                      <div className="npf-top">
                        <span className="npf-kind">
                          {sg.kind === 'DIRECT' ? t('پیوند مستقیم') : sg.kind === 'INTRO' ? t('معرفی') : sg.kind === 'STEP' ? t('گام اول') : t('ایجاد رابطه')}
                        </span>
                        {Number.isFinite(Number(sg.score)) && <span className="chip info">امتیاز پتانسیل {fmtNum(sg.score)}</span>}
                      </div>
                      <div className="npf-route">«{sg.fromOrgName ?? '—'}» ← «{sg.toOrgName ?? '—'}»</div>
                      {sg.viaPerson ? <div className="npf-via">از طریق {sg.viaPerson} و {sg.toPerson}</div> : null}
                      {Number.isFinite(Number(sg.sharedMeetings)) && (
                        <div className="npf-ev">{fmtNum(sg.sharedMeetings)} جلسهٔ مشترک بین دو سازمان</div>
                      )}
                      {sg.reason ? <div className="npf-reason">{sg.reason}</div> : null}
                      {sg.kind === 'STEP' && sg.viaOrg && (
                        <button className="net-btn primary npf-go" onClick={() => goStep(sg)}>
                          نمایش مسیر تا {sg.viaOrgName ?? faEntityId(sg.viaOrg)}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* مسیر یافت شد ولی پرریسک → بهبودها + جایگزین‌ها */}
              {path.found && (
                <>
                  {Array.isArray(path.improvements) && path.improvements.length > 0 && (
                    <div className="npf-block npf-improve">
                      <div className="npf-title">پیشنهادهای بهبود مسیر {path.isRisky ? t('· مسیر پرریسک') : ''}</div>
                      {path.improvements.map((im: any) => (
                        <div className="npf-card npf-improve-item" key={im.id}>
                          <div className="npf-top">
                            <span className="npf-kind">
                              {im.kind === 'STRENGTHEN' ? t('تقویت پیوند') : im.kind === 'GOVERNANCE' ? t('حاکمیت معرف') : im.kind === 'BACKUP' ? t('مسیر پشتیبان') : im.kind === 'BRIDGE' ? t('ایجاد پل') : t('راهکار')}
                            </span>
                            {(im.fromOrgName || im.toOrgName) && <span className="npf-where">«{im.fromOrgName ?? '—'}» ← «{im.toOrgName ?? '—'}»</span>}
                          </div>
                          <div className="npf-reason">{im.action}</div>
                          {im.impact ? <div className="npf-impact">{im.impact}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {Array.isArray(path.alternatives) && path.alternatives.length > 0 && (
                    <div className="npf-block npf-alts">
                      <div className="npf-title">{t('مسیرهای جایگزین (برای مقایسه کلیک کنید)')}</div>
                      <div className="npf-alt-row">
                        {path.alternatives.map((alt: any) => (
                          <button key={alt.id} className="net-btn npf-alt-btn" onClick={() => setPath(alt)}>
                            {fmtNum(alt.hops)} پرش · امتیاز {fmtNum(alt.score)} · {alt.scoreLabel ?? '—'}{alt.isRisky ? t('· پرریسک') : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Graph canvas */}
          <div className="net-graph-zone">
            {graphFs ? (
              <div className="net-zone-fs-hold"><Maximize2 size={18}/> {t('گراف در نمای تمام‌صفحه باز است — برای بازگشت دکمهٔ «بستن» یا Esc را بزنید.')}</div>
            ) : (
            <GraphBoundary>
              <NetworkGraph
                ref={graphHandle}
                graph={graphProp}
                variant={variant}
                selectedNodeId={selected?.id ?? null}
                selectedEdgeId={selectedEdgeId}
                focusNodeId={focus || null}
                pathNodeIds={path?.found ? pathNodeSet : null}
                pathEdgeIds={path?.found ? pathEdgeSet : null}
                analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                dimOthers={Boolean(selectedNode)}
                onNodeSelect={onNodeSelect}
                onNodeHover={(n) => setHoverNode(n ?? null)}
                onEdgeSelect={(id) => { setSelectedEdgeId(id); setRailTab('overview'); }}
                onEdgeHover={(label) => setHoverEdge(label)}
                onRendered={onRendered}
                onNodeOpen={openNodePage}
                onPathEnd={setPathEnd}
              />
            </GraphBoundary>
            )}
          </div>
          <div className="net-hover-line">
            {hoverNode && !selectedNode
              ? <>{t('گرهٔ نشان‌شده:')} <b>{nodeDisplayName(hoverNode)}</b> ({fa(hoverNode.type)}) — کلیک = جزئیات · دابل‌کلیک = باز کردن صفحه</>
              : hoverEdge && !selectedEdgeId
                ? (() => {
                    const e = graph?.edges.find((x) => x.id === hoverEdge) ?? null;
                    if (!e) return null;
                    const a = idToNode(e.source);
                    const b = idToNode(e.target);
                    const st = statusMeta(edgeStatus(e));
                    return <>{t('پیوندِ نشان‌شده:')} <b>{a ? nodeDisplayName(a) : e.source} ↔ {b ? nodeDisplayName(b) : e.target}</b> · {e.label ? fa(e.label) : kindLabel(e.kind)} · <span style={{ color: st.color }}>{st.label}</span>{e.kind === 'relationship' && Number.isFinite(e.risk) ? ` ${t('· ریسک')} ${fmtNum(e.risk)}` : ''}</>;
                  })()
                : t('نشانگر را روی گره ببرید (کلیک = جزئیات) یا روی خط رابطه (انتخاب خط).')}
          </div>

          {/* Legend */}
          {showLegend && (
            <div className="net-legend">
              {variant === 'nested' ? (
                <div>
                  <strong>{t('چیدمان مرحله‌ای (مرحله به مرحله)')}</strong>{' '}
                  <span className="lg">{t('مرکز: خودِ شرکت · راست: زیرمجموعه‌ها و هلدینگ‌های بزرگ · چپ: روابط مستقیم')}</span>
                  <span className="lg">خط‌های قرمز بالا: عموم‌های بدون رابطهٔ مستقیم — رنگ نقطه = دسته؛ چیپ پایین = فهرست کامل دسته</span>
                  <span className="lg">کلیک روی سازمان = ورود به شبکهٔ آن (زیرمجموعه‌ها یک‌سو، روابط سوی دیگر) · دابل‌کلیک = صفحهٔ سازمان</span>
                </div>
              ) : null}
              <div>
                <strong>{t('گره‌ها')}</strong>{' '}
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#6C8FF7,#3B5BDB)', borderRadius: 4 }} />{t('سازمان')}</span>
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#2ED3A6,#0E9F6E)', borderRadius: '50%' }} />{t('شخص')}</span>
                <span className="lg"><span className="sw" style={{ background: 'linear-gradient(135deg,#9B6CF7,#6D28D9)', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} />{t('پروژه')}</span>
                <span className="lg"><span className="sw" style={{ background: PATH_COLOR }} />{t('مسیر / تمرکز')}</span>
              </div>
              <div>
                <strong>{t('وضعیت رابطه (روی خط)')}</strong>{' '}
                {STATUSES.map((s) => {
                  const meta = statusMeta(s);
                  const cnt = statusCounts.get(s) ?? 0;
                  return (
                    <span className="lg" key={s}>
                      <span
                        className="sw line"
                        style={{
                          background: meta.color,
                          backgroundImage: meta.dash
                            ? `repeating-linear-gradient(90deg, ${meta.color} 0 ${meta.dash[0]}px, transparent ${meta.dash[0]}px ${meta.dash[0] + meta.dash[1]}px)`
                            : undefined,
                        }}
                      />
                      {meta.label}
                      <b className="lg-count">{fmtNum(cnt)}</b>
                    </span>
                  );
                })}
                <span className="lg"><span className="sw line" style={{ background: '#94A3B8' }} />{t('عضویت (شخص ← سازمان)')}</span>
                <span className="lg"><span className="sw line" style={{ background: PATH_COLOR }} />{t('پیوند مسیر')}</span>
              </div>
              <div>
                <strong>{t('دستهٔ عموم‌ها (رنگ گره)')}</strong>{' '}
                {PUBLIC_CATEGORY_ORDER.map((k) => {
                  const meta = PUBLIC_CATEGORY_META[k];
                  const cnt = catCounts.byCat.get(k) ?? 0;
                  return (
                    <span className="lg" key={k}>
                      <span className="sw" style={{ background: meta.color, borderRadius: k === 'INTERNAL' ? 4 : '50%' }} />
                      {meta.fa}
                      <b className="lg-count">{fmtNum(cnt)}</b>
                    </span>
                  );
                })}
                <span className="lg"><span className="sw" style={{ background: `repeating-linear-gradient(45deg, ${EGO_COLOR} 0 3px, #fff 3px 6px)`, borderRadius: 4 }} />{EGO_FA} (حلقهٔ طلایی)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right detail rail */}
        <aside className="net-detail" aria-label={t('جزئیات گره / پیوند')}>
          {selectedNode ? (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{nodeDisplayName(selectedNode)}</h3>
                  <div className="kind">{fa(selectedNode.type)} · {selectedNode.organizationId ? `${t('شناسهٔ')} ${faEntityId(selectedNode.organizationId)}` : t('سازمان آزاد')}</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedNode(null)} title={t('بستن')}>✕</button>
              </div>
              <div className="net-detail-tabs">
                {(['overview', 'relationships', 'insights'] as const).map((tab) => (
                  <button key={tab} className={railTab === tab ? 'active' : ''} onClick={() => setRailTab(tab)}>
                    {tab === 'overview' ? t('نمای کلی') : tab === 'relationships' ? `${t('روابط (')}${fmtNum(railRelationships.length)})` : t('بینش‌ها')}
                  </button>
                ))}
              </div>
              <div className="net-detail-body">
                {railTab === 'overview' && (
                  <>
                    <div className="net-kv">
                      <div className="kv"><small>{t('شناسه')}</small><strong>{faEntityId(selectedNode.id)}</strong></div>
                      <div className="kv"><small>{t('روابط مرتبط')}</small><strong>{fmtNum(railNodeDegree)}</strong></div>
                      {selectedNode.type !== 'project' && (
                        <div className="kv kv-wide">
                          <small>{t('ارزیابی معیارمحور')}</small>
                          <CriteriaRailChip subjectType={selectedNode.type === 'person' ? 'PERSON' : 'ORGANIZATION'} subjectId={selectedNode.id} />
                        </div>
                      )}
                    </div>
                    {(() => {
                      const tally = new Map<string, number>();
                      let risky = 0;
                      for (const e of railRelationships) {
                        if (e.kind !== 'relationship' && e.kind !== 'person_relationship') continue;
                        const s = edgeStatus(e);
                        tally.set(s, (tally.get(s) ?? 0) + 1);
                        if (Number.isFinite(e.risk) && (e.risk ?? 0) >= RISK_THRESHOLD) risky++;
                      }
                      const arr = [...tally.entries()].sort((a, b) => b[1] - a[1]);
                      return (
                        <div className="net-rail-block">
                          {arr.length ? (
                            <div className="net-rail-chips">
                              {arr.map(([s, c]) => {
                                const m = statusMeta(s);
                                return (
                                  <span key={s} className="rail-chip" style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}12` }}>
                                    <i style={{ background: m.color }} />
                                    {m.label} · {fmtNum(c)}
                                  </span>
                                );
                              })}
                              {risky > 0 && <span className="rail-chip danger">⚠ {fmtNum(risky)} پرریسک</span>}
                            </div>
                          ) : (
                            <div className="t-muted" style={{ fontSize: 12 }}>{t('پیوند رابطه‌ای برای این گره در گراف بارگذاری‌شده نیست.')}</div>
                          )}
                          {selectedNode.type === 'organization' && (
                            <div className="net-rail-actions">
                              <span className="ra-label">{t('مسیر سازمانی:')}</span>
                              <button className="net-btn" disabled={from === selectedNode.id} onClick={() => setPathEnd(selectedNode, 'from')}>{t('از اینجا')}</button>
                              <button className="net-btn" disabled={to === selectedNode.id} onClick={() => setPathEnd(selectedNode, 'to')}>{t('تا اینجا')}</button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="net-detail-actions" style={{ padding: 0, border: 0 }}>
                      {(() => { const r = nodeEntityRoute(selectedNode); return r ? <DetailButton href={r.href} label={`${t('باز کردن')} ${fa(selectedNode.type)}`} /> : null; })()}
                      <button className="net-btn primary" onClick={() => expandNode(selectedNode)}>{t('گسترش همسایه‌ها')}</button>
                    </div>
                  </>
                )}
                {railTab === 'relationships' && (
                  railRelationships.length ? (
                    <div className="net-entity-nav">
                      {railRelationships.map((e) => {
                        const other = e.source === selectedNode.id ? e.target : e.source;
                        const on = idToNode(other);
                        return (
                          <div className="en" key={e.id}>
                            <button
                              className="net-btn"
                              style={{ border: 0, background: 'none', padding: 0, textAlign: 'right', fontWeight: 700, minHeight: 'auto' }}
                              onClick={() => selectEdge(e.id)}
                              title={t('انتخاب خط در گراف')}
                            >
                              {on ? nodeDisplayName(on) : other}
                              <small style={{ display: 'block', fontWeight: 400 }}>{kindLabel(e.kind)}{e.label ? ` · ${e.label}` : ''}{Number.isFinite(e.risk) && e.risk >= RISK_THRESHOLD ? <b style={{ color: 'var(--srip-danger)' }}> · risk {e.risk}</b> : ''}</small>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="net-empty">{t('پیوندی برای این گره در گراف بارگذاری‌شده یافت نشد.')}</div>
                )}
                {railTab === 'insights' && (
                  <>
                    <div className="net-kv">
                      <div className="kv"><small>{t('درجه (پیوندها)')}</small><strong>{fmtNum(railNodeDegree)}</strong></div>
                      <div className="kv"><small>{t('روابط پرریسک')}</small><strong style={{ color: railNodeRisky ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{fmtNum(railNodeRisky)}</strong></div>
                    </div>
                    {railNodeTopRel && (
                      <div className="insight-card">
                        <b>{t('رابطه راهبردی برتر')}</b>
                        <p>{railNodeTopRel.label ?? kindLabel(railNodeTopRel.kind)} · راهبردی {fmtNum(railNodeTopRel.strategicImportance)}</p>
                      </div>
                    )}
                    {kpi.influencer?.id === selectedNode.id && (
                      <div className="insight-card">
                        <b>{t('گره تأثیرگذار')}</b>
                        <p>تأثیرگذارترین شخص در گراف بارگذاری‌شده ({fmtNum(kpi.influencerDeg)} پیوند).</p>
                        <span className="derive">{t('مشتق‌شده — از همان گراف بارگذاری‌شده')}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : selectedEdge ? (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</h3>
                  <div className="kind">{t('خط · سیاهه روابط')}</div>
                </div>
                <button className="net-btn" onClick={() => setSelectedEdgeId(null)} title={t('بستن')}>✕</button>
              </div>
              <div className="net-detail-body">
                {(() => {
                  const st = edgeStatus(selectedEdge);
                  const meta = statusMeta(st);
                  const risk = Number.isFinite(selectedEdge.risk) ? selectedEdge.risk : 0;
                  const strat = Number.isFinite(selectedEdge.strategicImportance) ? selectedEdge.strategicImportance : 0;
                  const health = Number.isFinite((selectedEdge as any).health) ? (selectedEdge as any).health : Math.max(0, Math.min(100, 100 - risk));
                  const weight = Number.isFinite(selectedEdge.weight) ? selectedEdge.weight : 0;
                  const bars = [
                    { label: t('سلامت رابطه'), value: health, color: 'var(--teal, #0E9F6E)' },
                    { label: t('ریسک'), value: risk, color: 'var(--red, #DC2626)' },
                    { label: t('ارزش استراتژیک'), value: strat, color: 'var(--indigo, #4F46E5)' },
                    { label: t('قوت پیوند'), value: Math.min(100, weight), color: 'var(--blue, #2563EB)' },
                  ];
                  return (
                    <>
                      <div className="score-banner" style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}33` }}>
                        <span className="status-dot" style={{ background: meta.color, width: 10, height: 10 }} />
                        <div>
                          <b style={{ color: meta.color }}>{meta.label}</b>
                          <small>{t('وضعیت رابطه')}</small>
                        </div>
                        <span className="status-type">{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</span>
                      </div>
                      <div className="score-bars">
                        {bars.map((b) => (
                          <div className="score-bar" key={b.label}>
                            <span>{b.label}</span>
                            <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, b.value))}%`, background: b.color }} /></span>
                            <b>{fmtNum(Math.round(b.value))}</b>
                          </div>
                        ))}
                      </div>
                      <div className="net-kv">
                        <div className="kv"><small>{t('نوع')}</small><strong>{selectedEdge.label ?? kindLabel(selectedEdge.kind)}</strong></div>
                        <div className="kv"><small>{t('شناسه')}</small><strong>{faEntityId(selectedEdge.id)}</strong></div>
                      </div>
                    </>
                  );
                })()}
                <div className="net-entity-nav">
                  {[selectedEdge.source, selectedEdge.target].map((id) => {
                    const n = idToNode(id);
                    const r = n ? nodeEntityRoute(n) : null;
                    return (
                      <div className="en" key={id}>
                        <span>{n ? nodeDisplayName(n) : id}<small>{fa((n as any)?.type)}</small></span>
                        {r && n ? <Link href={r.href}>{t('باز کردن')}</Link> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="net-detail-head">
                <div>
                  <h3>{t('نمای کلی شبکه')}</h3>
                  <div className="kind">{t('مشتق از داده‌های سرور')}</div>
                </div>
              </div>
              <div className="net-detail-body">
                <div className="net-kv">
                  <div className="kv"><small>{t('سلامت گراف')}</small><strong>{fmtNum(kpi.graphHealth)}٪</strong></div>
                  <div className="kv"><small>{t('پیوند‌های پرریسک')}</small><strong style={{ color: kpi.risk ? 'var(--srip-danger)' : 'var(--srip-success)' }}>{fmtNum(kpi.risk)}</strong></div>
                  <div className="kv"><small>{t('پیوند‌های راهبردی')}</small><strong>{fmtNum(kpi.opp)}</strong></div>
                  <div className="kv"><small>{t('روابط سازمان')}</small><strong>{fmtNum(kpi.relationshipCount)}</strong></div>
                </div>
                <div className="insight-card">
                  <b>{t('خلاصه هوشمند')}</b>
                  {derivedInsights.slice(0, 3).map((d, i) => <p key={i}>{d}</p>)}
                  <span className="derive">{t('مشتق‌شده — از گراف بارگذاری‌شده با مجوز واقعی')}</span>
                </div>
                <div className="net-empty">{t('یک گره یا پیوند را در گراف انتخاب کنید تا جزئیات، روابط و بینش‌های آن را ببینید.')}</div>
              </div>
            </>
          )}
          <div className="net-detail-actions">
            <button className="net-btn primary" onClick={() => {
              setShowAnalysis(true); setView('analysis');
              if (!analysis || !analysisList.length) runAnalysis('centrality');
            }}>
              {t('تحلیل کامل شبکه')}
            </button>
          </div>
        </aside>
          </div>

      {/* Full analysis sheet */}
      {showAnalysis && (
        <section className="card analysis-sheet">
          <div className="net-detail-tabs" style={{ padding: '0 0 8px', background: 'none' }}>
            <button className={analysisKind === 'centrality' ? 'active' : ''} onClick={() => runAnalysis('centrality')}>{t('مرکزیت')}</button>
            <button className={analysisKind === 'connectors' ? 'active' : ''} onClick={loadConnectors}>{t('اتصال‌دهنده‌ها')}</button>
            <button className={analysisKind === 'bridges' ? 'active' : ''} onClick={() => runAnalysis('bridges')}>{t('افراد پل')}</button>
            <button className={analysisKind === 'bottlenecks' ? 'active' : ''} onClick={() => runAnalysis('bottlenecks')}>{t('گلوگاه‌ها')}</button>
            <button className={analysisKind === 'single-points-of-failure' ? 'active' : ''} onClick={() => runAnalysis('single-points-of-failure')}>{t('نقاط تک‌خطا')}</button>
          </div>
          <p className="muted">{t('روی هر نتیجه کلیک کنید تا همان گره در گراف انتخاب شود.')}</p>
          {analysis ? (
            <div className="table-wrap">
              {renderAnalysis(analysisKind || 'centrality', analysisList, selectAnalyticsNode, analysisNodeSet)}
            </div>
          ) : <Empty>{t('برای نمایش تحلیل کامل، یکی از دکمه‌های بالا را اجرا کنید.')}</Empty>}
        </section>
      )}
        </div>
        </div>
        </>
      )}

      {view === 'priorities' && (
        <aside className="content-side net-priorities">
      {/* Side rail */}
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-red"><Target size={14}/></span><h3>{t('امروز در اولویت')}</h3><span className="lc-badge">{fmtNum(riskPriorities.length)}</span></div>
          <p className="panel-note">{t('پرریسک‌ترین روابط در گراف بارگذاری‌شده (طبقه‌بندی بر اساس امتیاز ریسک).')}</p>
          {riskPriorities.length ? (
            <div className="item-list">
              {riskPriorities.map((e) => {
                const a = idToNode(e.source); const b = idToNode(e.target);
                return (
                  <button className="item" key={e.id} onClick={() => selectEdge(e.id)} title={t('انتخاب در گراف')}>
                    <span>
                      <b>{a ? nodeDisplayName(a) : e.source} ↔ {b ? nodeDisplayName(b) : e.target}</b>
                      <small style={{ display: 'block' }}>{kindLabel(e.kind)}{e.label ? ` · ${e.label}` : ''}</small>
                    </span>
                    <span className="meta">ریسک {fmtNum(e.risk)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty>{t('در گراف بارگذاری‌شده رابطه پرریسکی یافت نشد.')}</Empty>
          )}
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-purple"><Zap size={14}/></span><h3>{t('توصیه‌های هوشمند')}</h3></div>
          <p className="panel-note">{t('مشتق از اجرای واقعی تحلیل‌های شبکه (مرکزیت / اتصال‌دهنده‌ها / افراد پل / گلوگاه‌ها / نقاط تک‌خطا).')}</p>
          <div className="item-list">
            {recommendations.map((r: any, i) => (
              <div className="item" key={i}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    {r.tone === 'danger' ? <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-danger)' }} />
                      : r.tone === 'warning' ? <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-warning, #f59e0b)' }} />
                        : <Lightbulb size={14} style={{ flex: '0 0 auto', marginTop: 2, color: 'var(--srip-success)' }} />}
                    <b style={{ fontSize: 12, lineHeight: 1.7 }}>{r.text}</b>
                  </span>
                  {r.sub && <span className="t-muted" style={{ fontSize: 12, lineHeight: 1.7 }}>{r.sub}</span>}
                  {r.href && (
                    <Link href={r.href} style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, color: 'var(--srip-accent-text)', textDecoration: 'none' }}>
                      مشاهدهٔ رابطه ←
                    </Link>
                  )}
                </span>
                <span className={`ui-badge ${r.tone}`}>
                  {r.tone === 'danger' ? t('فوری') : r.tone === 'warning' ? t('هشدار') : r.tone === 'info' ? t('بینش') : t('پیشنهاد')}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span className="t-muted" style={{ fontSize: 12 }}>{t('تحلیل شبکه:')}</span>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => runAnalysis('centrality')}>{t('مرکزیت')}</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={loadConnectors}>{t('اتصال‌دهنده‌ها')}</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => runAnalysis('bridges')}>{t('افراد پل')}</button>
            <button className="net-btn" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => runAnalysis('bottlenecks')}>{t('گلوگاه‌ها')}</button>
          </div>
        </div>
        <div className="list-card">
          <div className="lc-head"><span className="lc-ico ic-blue"><Clock size={14}/></span><h3>{t('فعالیت‌های این نشست')}</h3><span className="lc-badge">{fmtNum(activities.length)}</span></div>
          <p className="panel-note">{t('رویدادهای واقعی تعامل شما با این صفحه در جلسه فعلی.')}</p>
          {activities.length ? (
            <div style={{ display: 'grid', gap: 4 }}>
              {activities.map((a, i) => (
                <div className="activity" key={i}>
                  {a.label}
                  <time>{new Date(a.t).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{t('هنوز فعالیتی ثبت نشده؛ فیلتر، مسیر یا تحلیلی را امتحان کنید.')}</Empty>
          )}
        </div>
        <div className="footer-note">
          {t('همه مقادیر از سرور واقعی با مجوز سازمانی گرفته شده‌اند؛ هیچ داده نمایشی/جعلی اضافه نشده است.')}
        </div>
        </aside>
        )}

      {typeof document !== 'undefined' && graphFs
        ? createPortal(
            <div className="net-fs" role="dialog" aria-modal="true" aria-label={t('گراف شبکه — تمام صفحه')}>
              <div className="net-fs-bar">
                <div className="net-fs-title">
                  <Network size={16} />
                  <div>
                    <b>{t('شبکهٔ خوشه‌ای ارتباطات')}</b>
                    <span className="counts">{fmtNum(renderCounts.nodes)} گره · {fmtNum(renderCounts.edges)} پیوند</span>
                  </div>
                </div>
                <div className="net-graph-toolbar">
                  <button className={`net-btn ${variant === 'nested' ? 'primary' : ''}`} onClick={() => { setVariant('nested'); log(t('چیدمان مرحله‌ای')); }}>{t('مرحله‌ای')}</button>
                  <button className={`net-btn ${variant === 'classic' ? 'primary' : ''}`} onClick={() => { setVariant('classic'); log(t('چیدمان کلاسیک')); }}>{t('کلاسیک')}</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.fit()} title={t('متناسب با نما')}><Maximize size={12}/> {t('متناسب')}</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.reset()} title={t('بازنشانی')}>{t('بازنشانی')}</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(1.35)} title={t('بزرگ‌نمایی')} aria-label={t('بزرگ‌نمایی')}>+</button>
                  <button className="net-btn" onClick={() => graphHandle.current?.zoomBy(0.74)} title={t('کوچک‌نمایی')} aria-label={t('کوچک‌نمایی')}>−</button>
                  <span className="net-pinch-hint" title={t('با دو انگشت زوم کنید؛ دوباره‌لمس روی زمینه = بزرگ‌نمایی')}><Maximize size={12} /> {t('دو انگشت')}</span>
                  <button className="net-btn" onClick={() => setShowLegend(!showLegend)} title={t('نمایش/عدم نمایش راهنما')}>{t('راهنما')}</button>
                  {focus ? <button className="net-btn" onClick={clearFocus} title={t('بازگشت به نمای کلی')}>{t('پاک‌کردن تمرکز')}</button> : null}
                  <button className="net-btn primary" onClick={() => setGraphFs(false)} title={t('بستن نمای تمام‌صفحه')}><X size={13}/> {t('بستن')}</button>
                </div>
              </div>
              <div className="net-fs-canvas">
                <GraphBoundary>
<NetworkGraph
                                  ref={graphHandle}
                                  graph={graphProp}
                                  variant={variant}
                                  selectedNodeId={selected?.id ?? null}
                                  selectedEdgeId={selectedEdgeId}
                                  focusNodeId={focus || null}
                                  pathNodeIds={path?.found ? pathNodeSet : null}
                                  pathEdgeIds={path?.found ? pathEdgeSet : null}
                                  analysisNodeIds={analysisNodeSet.size ? analysisNodeSet : null}
                                  dimOthers={Boolean(selectedNode)}
                                  onNodeSelect={onNodeSelect}
                                  onNodeHover={(n) => setHoverNode(n ?? null)}
                                  onEdgeSelect={(id) => { setSelectedEdgeId(id); setRailTab('overview'); }}
                                  onEdgeHover={(label) => setHoverEdge(label)}
                                  onRendered={onRendered}
                                  onNodeOpen={openNodePage}
                                  onPathEnd={setPathEnd}
                                />
                </GraphBoundary>
              </div>
            </div>,
            document.body
          )
        : null}
            {/* Node details shown in right rail above; graph canvas reveals details onClick */}
    </main>
  );
}