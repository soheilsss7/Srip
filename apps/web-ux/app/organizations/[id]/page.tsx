'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, Modal, PageHeader } from '../../_components/page-ui';
import { EgoGraph, type EgoNode } from '../../_components/ego-graph';
import { suggestConnections } from '../../_lib/connections';
import { Building2, Users, Share2, Link2, Sparkles, ArrowUpRight, CalendarDays, Network, HeartPulse, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d < 0) return '—';
  if (d === 0) return 'امروز';
  if (d === 1) return 'دیروز';
  if (d < 30) return fmtNum(d) + ' روز پیش';
  if (d < 365) return fmtNum(Math.floor(d / 30)) + ' ماه پیش';
  return fmtNum(Math.floor(d / 365)) + ' سال پیش';
}
function healthBand(h: number | null): { label: string; tone: 'success'|'info'|'warning'|'danger'|'neutral'; cls: string } {
  if (h == null) return { label:'بدون رابطه', tone:'neutral', cls:'h-null' };
  if (h >= 75) return { label:'سالم', tone:'success', cls:'h-hi' };
  if (h >= 55) return { label:'پایدار', tone:'info', cls:'h-mid' };
  if (h >= 40) return { label:'در معرض ریسک', tone:'warning', cls:'h-low' };
  return { label:'بحرانی', tone:'danger', cls:'h-crit' };
}
const bandTone = (cls: string): 'success'|'info'|'warning'|'danger'|'neutral' =>
  cls==='h-hi'?'success':cls==='h-mid'?'info':cls==='h-low'?'warning':cls==='h-crit'?'danger':'neutral';

const UNIT_TYPES = ['DEPARTMENT', 'DIVISION', 'BRANCH', 'BUSINESS_UNIT', 'LOCATION', 'OTHER'];
const CONTACT_KINDS = ['PHONE', 'EMAIL', 'ADDRESS', 'WEBSITE', 'LINKEDIN', 'OTHER'];

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [o, setO] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<null | 'unit' | 'contact'>(null);
  const [unitForm, setUnitForm] = useState({ name: '', type: 'DEPARTMENT', parentUnitId: '' });
  const [ctForm, setCtForm] = useState({ kind: 'PHONE', value: '', label: '', isPrimary: false });

  const load = useCallback(async () => {
    setError('');
    try {
      const [org, unitRows, tl, people, relList, orgList, inter] = await Promise.all([
        api(`/organizations/${id}`),
        api(`/core-domain/organizations/${id}/units`),
        api(`/organizations/${id}/timeline`),
        api('/people'),
        api('/relationships'),
        api('/organizations'),
        api('/interactions'),
      ]);
      setO(org); setUnits(arr(unitRows)); setTimeline(arr(tl));
      setMembers(arr(people).filter((p: any) => p.organizationId === id));
      setRels(arr(relList).filter((r: any) => r.sourceOrganizationId === id || r.targetOrganizationId === id));
      setAllOrgs(arr(orgList)); setInteractions(arr(inter));
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const graphNodes: EgoNode[] = useMemo(() => {
    const nodes: EgoNode[] = [];
    rels.slice(0, 10).forEach((r: any) => {
      const otherId = r.sourceOrganizationId === id ? r.targetOrganizationId : r.sourceOrganizationId;
      const other = allOrgs.find((x: any) => x.id === otherId);
      if (!other) return;
      nodes.push({
        id: other.id, name: other.name, kind: 'organization', sub: other.type,
        status: r.status, score: 100 - (r.riskScore ?? 30),
        href: `/organizations/${other.id}`,
      });
    });
    members.slice(0, 8).forEach((m: any) => {
      nodes.push({
        id: m.id, name: `${m.firstName} ${m.lastName ?? ''}`, kind: 'person',
        sub: m.title ?? 'عضو', edgeStyle: 'dashed', score: m.influenceScore ?? 60,
        href: `/people/${m.id}`,
      });
    });
    return nodes;
  }, [rels, members, allOrgs, id]);

  const suggestions = useMemo(() => {
    if (!o || !allOrgs.length || !rels.length) return [];
    return suggestConnections(id, { orgs: allOrgs, people: members, rels, interactions }).slice(0, 4);
  }, [o, id, allOrgs, members, rels, interactions]);

  /* ---- وضعیت رابطه (پاسخ به «وضعیت این سازمان چیست؟») ---- */
  const relStatus = useMemo(() => {
    if (!rels.length) return null;
    let worstHealth: number | null = null, worst: any = null;
    let maxRisk: number | null = null, maxStrategic: number | null = null, nextAt: string | null = null;
    let lastInter: string | null = null;
    for (const r of rels) {
      const h = r.healthScore ?? 0, k = r.riskScore ?? 0, st = r.strategicScore ?? 0;
      if (worstHealth == null || h < worstHealth) { worstHealth = h; worst = r; }
      maxRisk = maxRisk == null ? k : Math.max(maxRisk, k);
      maxStrategic = maxStrategic == null ? st : Math.max(maxStrategic, st);
      if (r.nextActionAt && (!nextAt || r.nextActionAt < nextAt)) nextAt = r.nextActionAt;
      const li = r.lastInteractionAt ?? null;
      if (li && (!lastInter || li > lastInter)) lastInter = li;
    }
    for (const i of interactions) {
      if (i.organizationId !== id && !rels.some((r: any) => r.id === i.relationshipId)) continue;
      if (i.occurredAt && (!lastInter || i.occurredAt > lastInter)) lastInter = i.occurredAt;
    }
    return { worstHealth, worst, maxRisk, maxStrategic, nextAt, lastInter, count: rels.length };
  }, [rels, interactions, id]);

  if (!o && !error) return <main className="feature-page"><PageHeader eyebrow="سازمان" title="سازمان" description="" actions={<></>} /><Loading /></main>;

  const counts = o?._count ?? {};
  const infoRows: Array<[string, string]> = [];
  if (o?.type) infoRows.push(['نوع', fa(o.type)]);
  if (o?.industry) infoRows.push(['صنعت', o.industry]);
  if (o?.country) infoRows.push(['کشور', o.country]);
  if (o?.createdAt) infoRows.push(['تاریخ ثبت', new Date(o.createdAt).toLocaleDateString('fa-IR')]);
  if (o?.parentOrganizationId) {
    const parent = allOrgs.find((x: any) => x.id === o.parentOrganizationId);
    infoRows.push(['سازمان مادر', parent?.name ?? '—']);
  }
  const band = healthBand(relStatus?.worstHealth ?? null);
  const tlTone = (k: string): any =>
    k === 'MEETING' ? 'success' : k === 'INTERACTION' ? 'info' : k === 'OPPORTUNITY' ? 'purple' : k === 'COMMITMENT' ? 'warning' : 'neutral';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="سازمان · پروفایل"
        title={o?.name ?? 'سازمان'}
        description={`${o?.type ? fa(o.type) : ''}${o?.industry ? ` · ${o.industry}` : ''}${o?.country ? ` · ${o.country}` : ''}`}
        actions={
          <div className="toolbar">
            <button className="secondary-action" onClick={() => setPanel('unit')}>+ واحد</button>
            <button className="secondary-action" onClick={() => setPanel('contact')}>+ تماس</button>
            <button className="secondary-action" onClick={load}>بازخوانی</button>
          </div>
        }
      />
      <ErrorCard message={error} />

      {o && (
        <>
          {/* profile strip */}
          <section className="profile-strip">
            <span className="stat-ico ic-blue" style={{ width: 48, height: 48, borderRadius: 14, flex: 'none' }}><Building2 size={22}/></span>
            <div className="profile-main">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2>{o.name}</h2>
                <Badge tone={o.status === 'ACTIVE' ? 'success' : 'neutral'}>{fa(o.status ?? 'ACTIVE')}</Badge>
                {o.parentOrganizationId && <Link className="chip info" href={`/organizations/${o.parentOrganizationId}`}><ArrowUpRight size={12}/> مادر</Link>}
              </div>
              <p>{o.industry ?? ''}{o.country ? ` · ${o.country}` : ''}</p>
            </div>
            <div className="profile-metrics">
              <span className="person-score"><Users size={13}/><b className="hi">{fmtNum(counts.people ?? members.length)}</b><small>اعضا</small></span>
              <span className="person-score"><Share2 size={13}/><b className="mid">{fmtNum(rels.length)}</b><small>روابط</small></span>
              <span className="person-score"><Network size={13}/><b className="mid">{fmtNum((counts.projects ?? 0) + (counts.opportunities ?? 0))}</b><small>پروژه/فرصت</small></span>
            </div>
          </section>

          {/* رابطه استاتوس — پاسخ به «وضعیت رابطه با این سازمان چیست؟» */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico"><HeartPulse size={17}/></span>
              <div>
                <h2>وضعیت رابطه با این سازمان</h2>
                <p>بر پایهٔ امتیاز سلامت، ریسک و تازگی تعامل — محاسبهٔ زنده از روابط ثبت‌شده</p>
              </div>
              <Badge tone={bandTone(band.cls)}>{band.label}</Badge>
            </div>
            {relStatus ? (
              <>
                <div className="rel-status-metrics">
                  <div className="rel-metric">
                    <span>سلامت رابطه</span>
                    <div className="rel-metric-value"><b className={band.cls}>{fmtNum(relStatus.worstHealth)}</b><small>از ۱۰۰</small></div>
                    <div className="rel-metric-bar"><span className={band.cls} style={{ width: `${relStatus.worstHealth ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>ریسک</span>
                    <div className="rel-metric-value"><b className={relStatus.maxRisk != null && relStatus.maxRisk >= 60 ? 'h-crit' : relStatus.maxRisk != null && relStatus.maxRisk >= 40 ? 'h-low' : 'h-hi'}>{fmtNum(relStatus.maxRisk)}</b><small>از ۱۰۰</small></div>
                    <div className="rel-metric-bar"><span className={relStatus.maxRisk != null && relStatus.maxRisk >= 60 ? 'h-crit' : relStatus.maxRisk != null && relStatus.maxRisk >= 40 ? 'h-low' : 'h-hi'} style={{ width: `${relStatus.maxRisk ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>ارزش راهبردی</span>
                    <div className="rel-metric-value"><b>{fmtNum(relStatus.maxStrategic)}</b><small>از ۱۰۰</small></div>
                    <div className="rel-metric-bar"><span style={{ width: `${relStatus.maxStrategic ?? 0}%` }}/></div>
                  </div>
                  <div className="rel-metric">
                    <span>آخرین تعامل</span>
                    <div className="rel-metric-value"><b>{timeAgo(relStatus.lastInter)}</b><small>{relStatus.lastInter ? fmtDate(relStatus.lastInter) : 'ثبت نشده'}</small></div>
                  </div>
                  <div className="rel-metric">
                    <span>اقدام بعدی</span>
                    <div className="rel-metric-value"><b>{relStatus.nextAt ? fmtDate(relStatus.nextAt) : '—'}</b><small>{relStatus.nextAt ? 'برنامه‌ریزی‌شده' : 'اقدامی ثبت نشده'}</small></div>
                  </div>
                </div>
                <div className="rel-status-list">
                  {rels.map((r: any) => {
                    const otherId = r.sourceOrganizationId === id ? r.targetOrganizationId : r.sourceOrganizationId;
                    const other = allOrgs.find((x: any) => x.id === otherId);
                    const h = r.healthScore ?? 0;
                    const b = healthBand(h);
                    return (
                      <Link className="rel-status-row" href={`/relationships/${r.id}`} key={r.id}>
                        <span className={`health-dot ${b.cls}`} />
                        <span className="rel-status-row-name">{other?.name ?? '—'} <small>({fa(r.relationshipType)})</small></span>
                        <span className="rel-status-row-bar"><span className={`health-fill ${b.cls}`} style={{ width: `${h}%` }}/></span>
                        <b className={`health-num ${b.cls}`}>{fmtNum(h)}</b>
                        <Badge tone={bandTone(b.cls)}>{b.label}</Badge>
                        <Badge tone={r.status === 'ACTIVE' ? 'success' : 'warning'}>{fa(r.status)}</Badge>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="empty-state">هنوز رابطه‌ای برای این سازمان ثبت نشده — از صفحهٔ «روابط» نخستین رابطه را ایجاد کنید.</p>
            )}
          </section>

          <div className="split-panels">
            {/* Ego graph */}
            <section className="panel graph-panel">
              <div className="panel-title">
                <div><h2>گراف ارتباطات دقیق</h2><p>همهٔ روابط این سازمان با وضعیت + اعضای کلیدی</p></div>
                <Link className="btn btn-ghost btn-sm" href="/network">شبکهٔ کامل ←</Link>
              </div>
              <EgoGraph center={{ name: o.name, kind: 'organization', sub: o.industry ?? fa(o.type) }} centerHref={`/organizations/${id}`} nodes={graphNodes} height={340} />
            </section>

            {/* Info */}
            <section className="panel">
              <div className="panel-title"><div><h2>اطلاعات سازمان</h2><p>داده‌های اصلی</p></div></div>
              <div className="detail-grid">
                {infoRows.map(([k, v]) => (
                  <div className="detail-item" key={k}><small>{k}</small><strong>{v}</strong></div>
                ))}
                {infoRows.length === 0 && <p className="empty-state">داده‌ای ثبت نشده است.</p>}
              </div>

              <div className="panel-title" style={{ marginTop: 20 }}><div><h2>اعضای سازمان</h2><Badge>{fmtNum(members.length)}</Badge></div></div>
              {members.length ? (
                <div className="list">
                  {members.map((m: any) => (
                    <Link className="listRow linkable" href={`/people/${m.id}`} key={m.id} style={{ textDecoration: 'none' }}>
                      <span className="avatar">{`${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`}</span>
                      <span style={{ flex: 1 }}><strong>{m.firstName} {m.lastName}</strong><small>{m.title ?? 'بدون سمت'}</small></span>
                      {m.influenceScore != null && <Badge tone={m.influenceScore >= 75 ? 'success' : 'neutral'}>نفوذ {fmtNum(m.influenceScore)}</Badge>}
                    </Link>
                  ))}
                </div>
              ) : <p className="empty-state">عضوی ثبت نشده است.</p>}
            </section>
          </div>

          {/* Suggestions — derived from interactions & meetings results */}
          <section className="panel">
            <div className="panel-title">
              <div><h2><Sparkles size={15}/> پیشنهاد ارتباط جدید</h2><p>بر اساس ارتباطات مشترک، تعاملات اخیر و نتایج جلسات — موتور قطعی داخلی</p></div>
            </div>
            {suggestions.length ? (
              <div className="suggestions-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
                {suggestions.map((s) => (
                  <Link className="ai-match-card" href={s.href} key={s.id} style={{ textDecoration: 'none', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="stat-ico ic-purple" style={{ width: 30, height: 30, borderRadius: 9 }}><Link2 size={15}/></span>
                        {s.name}
                      </b>
                      <span className="confidence-num">{fmtNum(s.score)}٪</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.reasons.slice(0, 2).map((r) => <span className="chip info" key={r}>{r}</span>)}
                    </div>
                    {s.via.length > 0 && <div className="match-meta"><Sparkles size={12}/> از طریق: {s.via.slice(0, 3).join('، ')}</div>}
                  </Link>
                ))}
              </div>
            ) : <p className="empty-state"><Sparkles size={18}/> پیشنهادی برای این شبکه موجود نیست.</p>}
          </section>

          {/* Units + contacts */}
          <div className="split-panels">
            <section className="panel">
              <div className="panel-title"><div><h2>واحدها</h2><Badge>{fmtNum(units.length)}</Badge></div></div>
              {units.length ? (
                <div className="list">
                  {units.map((u: any) => (
                    <div key={u.id}>
                      <div className="listRow"><Badge tone="neutral">{fa(u.type)}</Badge><span><strong>{u.name}</strong>{u.children?.length ? <small>{fmtNum(u.children.length)} زیرمجموعه</small> : null}</span></div>
                      {(u.children ?? []).map((c: any) => (
                        <div className="listRow indent" key={c.id}><Badge tone="neutral">{fa(c.type)}</Badge><span><strong>{c.name}</strong></span></div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">واحدی ثبت نشده است.</p>}
            </section>
            <section className="panel">
              <div className="panel-title"><div><h2>اطلاعات تماس</h2><Badge>{fmtNum(contacts.length)}</Badge></div></div>
              {contacts.length ? (
                <div className="list">
                  {contacts.map((c: any) => (
                    <div className="listRow" key={c.id}>
                      <Badge tone={c.isPrimary ? 'success' : 'neutral'}>{fa(c.kind)}</Badge>
                      <span><strong dir="ltr">{c.value}</strong><small>{c.label || ''}{c.isPrimary ? ' · تماس اصلی' : ''}</small></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">تماسی ثبت نشده است.</p>}
            </section>
          </div>

          {/* Timeline */}
          <section className="panel">
            <div className="panel-title"><div><h2>خط زمانی</h2><p>جلسات، تعاملات، فرصت‌ها و تعهدات</p></div><Badge>{fmtNum(timeline.length)}</Badge></div>
            {timeline.length ? (
              <div className="list">
                {timeline.slice(0, 50).map((x: any, i: number) => (
                  <div className="listRow" key={x.id ?? i}>
                    <Badge tone={tlTone(x.kind ?? '')}>{fa(x.kind ?? 'EVENT')}</Badge>
                    <span><strong>{x.title || x.subject || x.description || x.name || x.eventType || '—'}</strong>
                      {(x.date || x.createdAt) ? <small><CalendarDays size={11} style={{ verticalAlign: '-1px' }}/> {new Date(x.date ?? x.createdAt).toLocaleString('fa-IR')}</small> : null}</span>
                    {x.status && <Badge tone={x.status === 'OPEN' ? 'warning' : x.status === 'DONE' ? 'success' : x.status === 'WON' ? 'success' : 'neutral'}>{fa(x.status)}</Badge>}
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">رویدادی ثبت نشده است.</p>}
          </section>

          {/* Add modal */}
          <Modal open={panel !== null} title={panel === 'contact' ? 'اطلاعات تماس جدید' : 'واحد جدید'} description={panel === 'contact' ? 'یک راه تماس برای این سازمان ثبت کنید.' : 'یک واحد سازمانی جدید زیر این سازمان ثبت کنید.'} onClose={() => setPanel(null)}
            footer={<>
              <button type="button" className="btn btn-secondary" onClick={() => setPanel(null)}>انصراف</button>
              {panel === 'contact'
                ? <button type="submit" form="org-contact-form" className="btn btn-primary">ثبت تماس</button>
                : <button type="submit" form="org-unit-form" className="btn btn-primary">ثبت واحد</button>}
            </>}>
            {panel === 'contact' ? (
              <form id="org-contact-form" className="entity-form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/core-domain/organizations/${id}/contacts`, { method: 'POST', body: JSON.stringify(ctForm) }); setCtForm({ kind: 'PHONE', value: '', label: '', isPrimary: false }); setPanel(null); await load(); } catch (x) { setError((x as Error).message); } }}>
                <div className="field"><label className="field-label">نوع تماس</label><select value={ctForm.kind} onChange={(e) => setCtForm({ ...ctForm, kind: e.target.value })}>{CONTACT_KINDS.map((k) => <option key={k} value={k}>{fa(k)}</option>)}</select></div>
                <div className="field"><label className="field-label">مقدار <span className="req">*</span></label><input required value={ctForm.value} onChange={(e) => setCtForm({ ...ctForm, value: e.target.value })} placeholder="شماره، نشانی یا نشانی وب"/></div>
                <div className="field full"><label className="field-label">برچسب</label><input value={ctForm.label} onChange={(e) => setCtForm({ ...ctForm, label: e.target.value })} placeholder="مثلاً: دفتر مرکزی، خط مستقیم"/></div>
                <div className="field full check-line"><input type="checkbox" checked={ctForm.isPrimary} onChange={(e) => setCtForm({ ...ctForm, isPrimary: e.target.checked })} /> تماس اصلی</div>
              </form>
            ) : (
              <form id="org-unit-form" className="entity-form" onSubmit={async (e) => { e.preventDefault(); try { await api(`/core-domain/organizations/${id}/units`, { method: 'POST', body: JSON.stringify({ name: unitForm.name, type: unitForm.type, parentUnitId: unitForm.parentUnitId || undefined }) }); setUnitForm({ name: '', type: 'DEPARTMENT', parentUnitId: '' }); setPanel(null); await load(); } catch (x) { setError((x as Error).message); } }}>
                <div className="field"><label className="field-label">نام واحد <span className="req">*</span></label><input required value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="مثلاً: واحد فروش"/></div>
                <div className="field"><label className="field-label">نوع واحد</label><select value={unitForm.type} onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}>{UNIT_TYPES.map((t) => <option key={t} value={t}>{fa(t)}</option>)}</select></div>
                <div className="field full"><label className="field-label">واحد والد (اختیاری)</label><select value={unitForm.parentUnitId} onChange={(e) => setUnitForm({ ...unitForm, parentUnitId: e.target.value })}><option value="">بدون واحد والد</option>{units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              </form>
            )}
          </Modal>
        </>
      )}
    </main>
  );
}
