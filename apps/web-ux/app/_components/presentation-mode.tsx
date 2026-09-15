'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../_lib/api';
import { Badge } from './page-ui';
import { Camera, ChevronLeft, ChevronRight, Pause, Play, Plus, Presentation, Trash2, X } from 'lucide-react';
import type { GGraph } from '../network/_nodes';

/* ═══════════════════════════════════════════════════════════════════════════
   حالت ارائه/روایت گراف (مسترپلن فاز ۲/۱۷) — الگوی Kumu Presentation Builder
   صحنه = وضعیت گراف (تمرکز + فیلتر دسته/موضع/قدرت + عنوان + یادداشت)؛
   دنبالهٔ صحنه‌ها برای جلسهٔ هیئت‌مدیره؛ پخش با کلید جهت؛ خروجی PNG هر صحنه.
   رندر قطعی بر پایهٔ همان گراف /network/graph + دادهٔ GIS برای موضع/قدرت.
   ═══════════════════════════════════════════════════════════════════════════ */

type Scene = {
  id: string; orgId: string; order: number; title: string; note: string | null;
  focus: { orgId: string } | null;
  filters: { category: string; stance: string | null; minPower: number; view: string };
};
type GisPoint = { organizationId: string; name: string; publicsCategory: string | null; stance: string | null; power: number | null; provinceFa: string; isTenantNode: boolean };

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const CAT_FA: Record<string, string> = { INTERNAL: 'داخلی', INSTITUTIONAL: 'نهادی و حاکمیتی', ACADEMIC: 'علمی و پژوهشی', ECONOMIC: 'اقتصادی', MEDIA: 'رسانه‌ای', ECOSYSTEM: 'اکوسیستم' };
const STANCE_COLOR: Record<string, string> = { KEY_PLAYER: '#dc2626', INFLUENCER: '#f59e0b', SUPPORTER: '#16a34a', OBSERVER: '#94a3b8' };

/* چیدمان قطعی: hash شناسه → زاویه؛ هستهٔ مستأجر حلقهٔ داخلی، بقیه حلقهٔ بیرونی */
const hashAngle = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) >>> 0; }
  return (h % 3600) / 10;
};

const W = 900, H = 560;

export default function PresentationMode({ graph, currentFocus, currentVariant, canWrite }: {
  graph: GGraph | null; currentFocus: string; currentVariant: 'nested' | 'classic'; canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [idx, setIdx] = useState(0);
  const [gis, setGis] = useState<GisPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [flash, setFlash] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bForm, setBForm] = useState({ title: '', note: '' });
  const svgRef = useRef<SVGSVGElement>(null);

  const load = useCallback(async () => {
    try {
      const [pr, g] = await Promise.all([api<any>('/network/presentation'), api<any>('/gis/stakeholders').catch(() => null)]);
      setScenes((pr?.scenes ?? []).slice().sort((a: Scene, b: Scene) => a.order - b.order));
      if (g?.points) setGis(g.points);
    } catch { /* صفحهٔ میزبان خطا را نشان می‌دهد */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const scene = scenes[idx] ?? null;
  const next = useCallback(() => setIdx(i => Math.min(scenes.length - 1, i + 1)), [scenes.length]);
  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  /* ناوبری با کلید جهت (RTL: چپ = بعدی) + Esc + پخش خودکار */
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setAutoPlay(false); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', f);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = ''; };
  }, [open, next, prev]);
  useEffect(() => {
    if (!open || !autoPlay) return;
    const t = setInterval(() => setIdx(i => (i + 1 < scenes.length ? i + 1 : 0)), 9000);
    return () => clearInterval(t);
  }, [open, autoPlay, scenes.length]);

  const gisMap = useMemo(() => {
    const m = new Map<string, GisPoint>();
    for (const p of gis) m.set(p.organizationId, p);
    return m;
  }, [gis]);

  /* گره‌های صحنه: سازمان‌های گراف با فیلتر دسته/موضع/قدرت + کانون (خودش + همسایه‌ها) */
  const nodes = useMemo(() => {
    if (!scene || !graph) return [];
    const catOk = (oid: string, cat: string | null | undefined) => scene.filters.category === 'ALL' || (cat ?? gisMap.get(oid)?.publicsCategory ?? null) === scene.filters.category;
    const stanceOk = (oid: string) => !scene.filters.stance || gisMap.get(oid)?.stance === scene.filters.stance;
    const powerOk = (oid: string) => (gisMap.get(oid)?.power ?? 0) >= (scene.filters.minPower ?? 0);
    let list = graph.nodes.filter(n => n.type === 'organization' && catOk(n.organizationId ?? '', n.category) && stanceOk(n.organizationId ?? '') && powerOk(n.organizationId ?? ''));
    if (scene.focus?.orgId) {
      const fid = graph.nodes.find(n => n.id === scene.focus!.orgId || n.organizationId === scene.focus!.orgId || n.id === `org:${scene.focus!.orgId}`)?.id ?? `org:${scene.focus.orgId}`;
      if (scene.filters.view === 'neighbors') {
        const neigh = new Set<string>([fid]);
        graph.edges.forEach(e => { if (e.source === fid) neigh.add(e.target); if (e.target === fid) neigh.add(e.source); });
        list = list.filter(n => neigh.has(n.id));
      }
      if (!list.some(n => n.id === fid)) {
        const fn = graph.nodes.find(n => n.id === fid);
        if (fn) list = [fn, ...list];
      }
    }
    return list.slice(0, 90);
  }, [scene, graph, gisMap]);

  const posOf = useCallback((nodeId: string, isFocus: boolean, isTenant: boolean) => {
    const cx = W / 2, cy = H / 2;
    if (isFocus) return { x: cx, y: cy };
    const ring = isTenant ? 0.42 : 1;
    const a = (hashAngle(nodeId) * Math.PI) / 180;
    const rx = (W / 2 - 70) * ring, ry = (H / 2 - 55) * ring;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  }, []);

  const edges = useMemo(() => {
    const ids = new Set(nodes.map(n => n.id));
    return (graph?.edges ?? []).filter(e => ids.has(e.source) && ids.has(e.target)).slice(0, 170);
  }, [nodes, graph]);

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg || !scene) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * 2; canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `scene-${scene.order}-${scene.title.slice(0, 18)}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  };

  const addScene = async () => {
    if (!bForm.title.trim()) return;
    setBusy(true); setFlash('');
    try {
      await api('/network/presentation/scenes', {
        method: 'POST',
        body: JSON.stringify({
          title: bForm.title.trim(), note: bForm.note.trim() || undefined,
          focus: currentFocus ? { orgId: currentFocus.replace(/^org:/, '') } : null,
          filters: { category: 'ALL', stance: null, minPower: 0, view: currentVariant === 'nested' && currentFocus ? 'neighbors' : 'ecosystem' },
        }),
      });
      setBForm({ title: '', note: '' });
      setBuilderOpen(false);
      setFlash('صحنه به انتهای روایت اضافه شد.');
      await load();
    } catch (e) { setFlash(`خطا: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const delScene = async (id: string) => {
    setBusy(true);
    try { await api(`/network/presentation/scenes/${id}`, { method: 'DELETE' }); await load(); setIdx(0); }
    finally { setBusy(false); }
  };

  return (
    <>
      <button className="net-btn primary" onClick={() => { setOpen(true); setIdx(0); }} disabled={!scenes.length}
        title="حالت ارائه: پخش روایت صحنه‌به‌صحنه برای جلسهٔ هیئت‌مدیره (کلیدهای جهت)">
        <Presentation size={13} /> ارائه ({fmtN(scenes.length)})
      </button>

      {open && scene && (
        <div className="pres-overlay" role="dialog" aria-label="حالت ارائهٔ گراف">
          <div className="pres-top">
            <Badge tone="info">صحنهٔ {fmtN(idx + 1)} از {fmtN(scenes.length)}</Badge>
            <h2>{scene.title}</h2>
            {scene.note && <p>{scene.note}</p>}
            <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {scene.filters.category !== 'ALL' && <span className="chip neutral">{CAT_FA[scene.filters.category] ?? scene.filters.category}</span>}
              {scene.filters.stance && <span className="chip neutral">{scene.filters.stance === 'KEY_PLAYER' ? 'بازیگر کلیدی' : scene.filters.stance}</span>}
              {scene.filters.minPower > 0 && <span className="chip neutral">قدرت ≥ {fmtN(scene.filters.minPower)}</span>}
              <span className="chip neutral">{scene.filters.view === 'neighbors' ? 'تمرکز + همسایه‌ها' : 'کل اکوسیستم'}</span>
            </span>
          </div>

          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`صحنهٔ ${scene.title} — ${fmtN(nodes.length)} گره و ${fmtN(edges.length)} پیوند`} style={{ width: '100%', maxWidth: 1100, height: 'auto', direction: 'ltr', alignSelf: 'center' }}>
            <text x={W - 16} y={26} fontSize={12} fill="#94a3b8" textAnchor="end" direction="rtl">
              {scene.title} — {fmtN(nodes.length)} ذینفع · {fmtN(edges.length)} پیوند
            </text>
            {edges.map(e => {
              const a = nodes.find(n => n.id === e.source);
              const b = nodes.find(n => n.id === e.target);
              if (!a || !b) return null;
              const pa = posOf(a.id, !!scene?.focus && a.id === (graph?.nodes.find(n => n.organizationId === scene!.focus!.orgId || n.id === `org:${scene!.focus!.orgId}`)?.id ?? ''), false);
              const pb = posOf(b.id, false, false);
              return <line key={e.id} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#cbd5e1" strokeWidth={1.1} />;
            })}
            {nodes.map(n => {
              const oid = n.organizationId ?? n.id.replace(/^org:/, '');
              const g = gisMap.get(oid);
              const focusNodeId = scene?.focus ? (graph?.nodes.find(x => x.organizationId === scene.focus!.orgId || x.id === `org:${scene.focus!.orgId}`)?.id ?? null) : null;
              const isFocus = !!focusNodeId && n.id === focusNodeId;
              const isTenant = !!(g?.isTenantNode) || !!n.ego;
              const pos = posOf(n.id, isFocus, isTenant);
              const color = g?.stance ? STANCE_COLOR[g.stance] : isTenant ? '#0f766e' : '#475569';
              const r = isFocus ? 13 : isTenant ? 8 : 5.5;
              return (
                <g key={n.id}>
                  {isFocus && <circle cx={pos.x} cy={pos.y} r={19} fill="none" stroke="#0f766e" strokeWidth={1.5} strokeDasharray="4 3" />}
                  <circle cx={pos.x} cy={pos.y} r={r} fill={color} fillOpacity={0.9} stroke="#fff" strokeWidth={1.2}>
                    <title>{`${n.label}${g?.provinceFa ? ' — ' + g.provinceFa : ''}${g?.stance ? ' · ' + g.stance : ''}`}</title>
                  </circle>
                  {(isFocus || isTenant || nodes.length <= 42) && (
                    <text x={pos.x} y={pos.y + r + 11} fontSize={9.5} fill="#334155" textAnchor="middle">{n.label}</text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="pres-controls">
            <button className="btn btn-ghost" onClick={prev} disabled={idx === 0} aria-label="صحنهٔ قبلی"><ChevronRight size={16} /></button>
            <button className="btn btn-primary" onClick={() => setAutoPlay(a => !a)} aria-pressed={autoPlay}>
              {autoPlay ? <><Pause size={13} /> توقف</> : <><Play size={13} /> پخش خودکار</>}
            </button>
            <button className="btn btn-ghost" onClick={next} disabled={idx >= scenes.length - 1} aria-label="صحنهٔ بعدی"><ChevronLeft size={16} /></button>
            <div className="pres-dots" role="tablist" aria-label="فهرست صحنه‌ها">
              {scenes.map((sc, i) => (
                <button key={sc.id} role="tab" aria-selected={i === idx} className={i === idx ? 'on' : ''} title={sc.title}
                  onClick={() => setIdx(i)} aria-label={`صحنهٔ ${i + 1}: ${sc.title}`} />
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportPng}><Camera size={13} /> خروجی صحنه</button>
            {canWrite && <button className="btn btn-secondary btn-sm" onClick={() => setBuilderOpen(b => !b)}><Plus size={13} /> صحنهٔ تازه</button>}
            <button className="btn btn-ghost" onClick={() => { setOpen(false); setAutoPlay(false); }} aria-label="بستن ارائه"><X size={16} /></button>
          </div>
          {flash && <div className="pres-flash" role="status">{flash}</div>}

          {builderOpen && (
            <div className="pres-builder">
              <b>افزودن صحنه از نمای فعلی شبکه</b>
              <p className="t-muted" style={{ fontSize: 11 }}>
                تمرکز فعلی گراف ({currentFocus || 'بدون تمرکز'}) و چیدمان ({currentVariant === 'nested' ? 'مرحله‌ای' : 'کلاسیک'}) در صحنهٔ تازه ذخیره می‌شود.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input placeholder="عنوان صحنه (مثلاً: تنظیم‌گران کلیدی انرژی)" value={bForm.title}
                  onChange={e => setBForm(f => ({ ...f, title: e.target.value }))} style={{ flex: '1 1 220px' }} />
                <input placeholder="یادداشت گفتار (اختیاری)" value={bForm.note}
                  onChange={e => setBForm(f => ({ ...f, note: e.target.value }))} style={{ flex: '1 1 220px' }} />
                <button className="btn btn-primary" disabled={busy || !bForm.title.trim()} onClick={addScene}>افزودن</button>
              </div>
              {scenes.length > 0 && (
                <div style={{ display: 'grid', gap: 4, marginTop: 10, maxHeight: 130, overflow: 'auto' }}>
                  {scenes.map((sc, i) => (
                    <span key={sc.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5 }}>
                      <b className="t-muted">{fmtN(i + 1)}.</b> {sc.title}
                      <button className="btn icon-only danger" style={{ marginInlineStart: 'auto' }} disabled={busy}
                        onClick={() => delScene(sc.id)} title="حذف صحنه" aria-label={`حذف صحنهٔ ${sc.title}`}><Trash2 size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
