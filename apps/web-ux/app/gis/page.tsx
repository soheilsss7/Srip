'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import { Camera, Globe2, Layers, MapPin } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   نقشهٔ جغرافیایی ذینفعان — GIS (مسترپلن فاز ۲/۱۲) — الگوی Borealis/TSC.ai
   GET /gis/stakeholders → نقاط (lat/lng واقعی مراکز استان) + لایه‌ها
   نمای نقطه‌ای استان‌محور با مریدین‌های مختصات — صفر وابستگی اینترنتی (PWA آفلاین).
   فیلتر لایه‌ای (دستهٔ عموم/موضع/حداقل قدرت) + خروجی PNG برای گزارش هیئت‌مدیره.
   ═══════════════════════════════════════════════════════════════════════════ */

type Point = {
  organizationId: string; name: string; type: string; parentOrganizationId: string | null;
  provinceId: string; provinceFa: string; city: string; lat: number; lng: number;
  isTenantNode: boolean; publicsCategory: string | null; stance: string | null;
  power: number | null; interest: number | null; relationshipCount: number;
  avgHealthScore: number | null; mediaMentionCount: number;
};
type GisData = {
  generatedAt: string; total: number; points: Point[];
  provinces: { id: string; fa: string; city: string; lat: number; lng: number; orgCount: number; avgHealth: number | null }[];
  layers: { category: string[]; stance: string[] }; note: string;
};

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));
const CAT_FA: Record<string, string> = { INTERNAL: 'داخلی', INSTITUTIONAL: 'نهادی و حاکمیتی', ACADEMIC: 'علمی و پژوهشی', ECONOMIC: 'اقتصادی', MEDIA: 'رسانه‌ای', ECOSYSTEM: 'اکوسیستم' };
const STANCE_FA: Record<string, string> = { KEY_PLAYER: 'بازیگر کلیدی', INFLUENCER: 'تأثیرگذار', SUPPORTER: 'حامی', OBSERVER: 'ناظر' };
const STANCE_COLOR: Record<string, string> = { KEY_PLAYER: '#dc2626', INFLUENCER: '#f59e0b', SUPPORTER: '#16a34a', OBSERVER: '#94a3b8' };

/* بوم نقشه: ایران بین طول ۴۴ تا ۶۳٫۵ و عرض ۲۵ تا ۴۰ (پروجکشن خطی بر مبنای مختصات جغرافیایی) */
const LNG_MIN = 43.8, LNG_MAX = 63.6, LAT_MIN = 24.8, LAT_MAX = 40.1;
const W = 760, H = 620, PAD = 34;
const xOf = (lng: number) => PAD + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (W - 2 * PAD);
const yOf = (lat: number) => H - PAD - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (H - 2 * PAD);

export default function GisPage() {
  const { me } = useWorkspace();
  const [data, setData] = useState<GisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('ALL');
  const [stance, setStance] = useState('');
  const [minPower, setMinPower] = useState(0);
  const [sel, setSel] = useState<Point | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    (async () => {
      try { setData(await api<GisData>('/gis/stakeholders')); }
      catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  const points = useMemo(() => (data?.points ?? []).filter(p =>
    (cat === 'ALL' || p.publicsCategory === cat) &&
    (!stance || p.stance === stance) &&
    (p.power ?? 0) >= minPower,
  ), [data, cat, stance, minPower]);

  /* خوشهٔ استانی: تعداد سازمان هر استان → شعاع حباب */
  const provinceClusters = useMemo(() => {
    const byId = new Map<string, { fa: string; lat: number; lng: number; count: number; names: string[] }>();
    for (const p of points) {
      const c = byId.get(p.provinceId) ?? { fa: p.provinceFa, lat: p.lat, lng: p.lng, count: 0, names: [] };
      c.count++; c.names.push(p.name);
      byId.set(p.provinceId, c);
    }
    return [...byId.values()].sort((a, b) => b.count - a.count);
  }, [points]);

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
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
      a.download = `gis-stakeholders-${cat}-${stance || 'all'}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  };

  const legendMax = Math.max(1, ...provinceClusters.map(c => c.count));

  return (
    <>
      <PageHeader
        eyebrow="مسترپلن فاز ۲/۱۲ — الگوی Borealis/Jambo و هیت‌مپ TSC.ai"
        title="نقشهٔ جغرافیایی ذینفعان (GIS)"
        description="پراکندگی جغرافیایی ذینفعان نهادی بر پایهٔ استان و شهر — نمای نقطه‌ای با مختصات واقعی، کاملاً آفلاین (بدون کاشی اینترنتی) و آمادهٔ خروجی تصویر برای گزارش هیئت‌مدیره."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={exportPng} disabled={!data}>
            <Camera size={13} /> خروجی PNG
          </button>
        }
      />
      {error && <ErrorCard message={error} />}
      {loading ? <Loading /> : data && (
        <>
          <div className="stat-grid">
            <StatCard icon={<MapPin size={18} />} label="ذینفعان روی نقشه" value={fmtN(data.total)} iconClass="ic-blue" sub="در محدودهٔ شما" />
            <StatCard icon={<Globe2 size={18} />} label="استان‌های فعال" value={fmtN(data.provinces.filter(p => p.orgCount > 0).length)} iconClass="ic-teal" sub="از ۱۲ استان پوشش‌داده" />
            <StatCard icon={<Layers size={18} />} label="نمایش فعلی" value={fmtN(points.length)} iconClass="ic-indigo" sub="پس از فیلتر لایه‌ای" />
          </div>

          <SectionCard title="نقشهٔ پراکندگی" icon={<MapPin size={16} />}
            description="اندازهٔ حباب = تعداد ذینفعان استان · رنگ نقطه = موضع (فقط هنگام فیلتر موضع) · با کلیک روی نقطه، جزئیات ذینفع."
            actions={
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input" value={cat} onChange={e => setCat(e.target.value)} aria-label="دستهٔ عموم">
                  <option value="ALL">همهٔ دسته‌ها</option>
                  {(data.layers?.category ?? []).map(c => <option key={c} value={c}>{CAT_FA[c] ?? c}</option>)}
                </select>
                <select className="input" value={stance} onChange={e => setStance(e.target.value)} aria-label="موضع">
                  <option value="">همهٔ مواضع</option>
                  {(data.layers?.stance ?? []).map(s => <option key={s} value={s}>{STANCE_FA[s] ?? s}</option>)}
                </select>
                <label style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11.5 }}>
                  حداقل قدرت: {fmtN(minPower)}
                  <input type="range" min={0} max={90} step={10} value={minPower} onChange={e => setMinPower(Number(e.target.value))} style={{ width: 90 }} />
                </label>
              </div>
            }>
            <div style={{ position: 'relative' }}>
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img"
                aria-label={`نقشهٔ پراکندگی جغرافیایی ${fmtN(points.length)} ذینفع در ${fmtN(provinceClusters.length)} استان`}
                style={{ width: '100%', height: 'auto', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }}>
                {/* شبکهٔ مختصات */}
                {[45, 50, 55, 60].map(lng => (
                  <g key={`v${lng}`}>
                    <line x1={xOf(lng)} y1={PAD - 10} x2={xOf(lng)} y2={H - PAD + 10} stroke="#e2e8f0" strokeWidth={1} />
                    <text x={xOf(lng)} y={H - PAD + 24} fontSize={9} fill="#94a3b8" textAnchor="middle">{lng}°E</text>
                  </g>
                ))}
                {[26, 30, 34, 38].map(lat => (
                  <g key={`h${lat}`}>
                    <line x1={PAD - 10} y1={yOf(lat)} x2={W - PAD + 10} y2={yOf(lat)} stroke="#e2e8f0" strokeWidth={1} />
                    <text x={PAD - 14} y={yOf(lat) + 3} fontSize={9} fill="#94a3b8" textAnchor="end">{lat}°N</text>
                  </g>
                ))}
                {/* کادر عنوان برای خروجی گزارش */}
                <text x={W - PAD} y={PAD - 16} fontSize={11} fill="#475569" textAnchor="end" direction="rtl">
                  نقشهٔ GIS ذینفعان — {fmtN(points.length)} ذینفع · {new Date().toLocaleDateString('fa-IR')}
                </text>
                {/* حباب استانی */}
                {provinceClusters.map((c, i) => {
                  const r = 10 + 26 * Math.sqrt(c.count / legendMax);
                  return (
                    <g key={i} style={{ cursor: 'default' }}>
                      <circle cx={xOf(c.lng)} cy={yOf(c.lat)} r={r} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" strokeOpacity={0.4} strokeWidth={1.2} />
                      <text x={xOf(c.lng)} y={yOf(c.lat) + 3.5} fontSize={11} fontWeight={700} fill="#4338ca" textAnchor="middle">{fmtN(c.count)}</text>
                      <text x={xOf(c.lng)} y={yOf(c.lat) + r + 12} fontSize={10.5} fill="#334155" textAnchor="middle">{c.fa}</text>
                    </g>
                  );
                })}
                {/* نقطه‌های ذینفع (با مواضع رنگی وقتی فیلتر موضع فعال است) */}
                {points.map(p => {
                  const colored = !!stance || cat !== 'ALL';
                  const color = p.isTenantNode ? '#0f766e' : (p.stance ? STANCE_COLOR[p.stance] : '#475569');
                  return (
                    <circle key={p.organizationId} cx={xOf(p.lng)} cy={yOf(p.lat)} r={p.isTenantNode ? 6 : colored && p.stance ? 5 : 3.4}
                      fill={colored && p.stance ? color : p.isTenantNode ? color : '#1e293b'} fillOpacity={0.85}
                      stroke="#fff" strokeWidth={1.1} style={{ cursor: 'pointer' }}
                      onClick={() => setSel(p)}>
                      <title>{`${p.name} — ${p.city} · ${p.publicsCategory ? CAT_FA[p.publicsCategory] ?? '' : 'بدون دسته'}${p.stance ? ` · ${STANCE_FA[p.stance]}` : ''}${p.avgHealthScore != null ? ` · سلامت ${p.avgHealthScore}` : ''}`}</title>
                    </circle>
                  );
                })}
              </svg>
              {/* راهنما */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: 11 }}>
                {(['KEY_PLAYER', 'INFLUENCER', 'SUPPORTER', 'OBSERVER'] as const).map(s => (
                  <span key={s} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <i style={{ width: 9, height: 9, borderRadius: '50%', background: STANCE_COLOR[s], display: 'inline-block' }} /> {STANCE_FA[s]}
                  </span>
                ))}
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <i style={{ width: 10, height: 10, borderRadius: '50%', background: '#0f766e', display: 'inline-block' }} /> هستهٔ هلدینگ شما
                </span>
              </div>
            </div>
            {sel && (
              <div className="notice" style={{ marginTop: 10 }} role="status">
                <b>{sel.name}</b> — {sel.city}، {sel.provinceFa}
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                  {sel.publicsCategory && <Badge tone="info">{CAT_FA[sel.publicsCategory] ?? sel.publicsCategory}</Badge>}
                  {sel.stance && <Badge tone={sel.stance === 'KEY_PLAYER' ? 'danger' : sel.stance === 'INFLUENCER' ? 'warning' : sel.stance === 'SUPPORTER' ? 'success' : 'neutral'}>{STANCE_FA[sel.stance]}</Badge>}
                  {sel.relationshipCount > 0 && <span className="chip neutral">{fmtN(sel.relationshipCount)} رابطه</span>}
                  {sel.avgHealthScore != null && <span className="chip neutral">میانگین سلامت {fmtN(sel.avgHealthScore)}</span>}
                  {sel.mediaMentionCount > 0 && <span className="chip neutral">{fmtN(sel.mediaMentionCount)} ذکر رسانه‌ای</span>}
                </span>
              </div>
            )}
            <p className="t-muted" style={{ fontSize: 11, marginTop: 8 }}>{data.note}</p>
          </SectionCard>

          <SectionCard title="خلاصهٔ استانی" icon={<Globe2 size={16} />} description="مبنای تحلیل پراکندگی جغرافیایی در گزارش هیئت‌مدیره.">
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
              {data.provinces.filter(p => p.orgCount > 0).map(p => (
                <div className="kpi-card" key={p.id} style={{ margin: 0 }}>
                  <small>{p.fa} — {p.city}</small>
                  <strong style={{ fontSize: 16 }}>{fmtN(p.orgCount)} ذینفع</strong>
                  <span className="t-muted" style={{ fontSize: 10.5 }}>{p.avgHealth != null ? `میانگین سلامت ${fmtN(p.avgHealth)}` : 'بدون رابطهٔ امتیازدار'}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
