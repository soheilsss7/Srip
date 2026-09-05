'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { fa } from '../../_lib/fa';
import { Badge, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { EgoGraph, type EgoNode } from '../../_components/ego-graph';
import { suggestConnections } from '../../_lib/connections';
import { Building2, Mail, Star, Crown, Sparkles, Link2, CalendarDays, HeartPulse, UserCheck, Zap, AlarmClock, ChevronLeft } from 'lucide-react';

const arr = (x: any): any[] => Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : Array.isArray(x?.data) ? x.data : Array.isArray(x?.rows) ? x.rows : [];
const fmtNum = (v: number | undefined | null): string =>
  v == null ? '—' : new Intl.NumberFormat('fa-IR').format(v);
const fmtDate = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' }) : '—';
const DONE_STATUSES = ['DONE', 'COMPLETED', 'CANCELLED'];
const scoreCls = (v: number | undefined | null): string => {
  if (v == null) return 'h-null';
  if (v >= 75) return 'h-hi';
  if (v >= 55) return 'h-mid';
  if (v >= 40) return 'h-low';
  return 'h-crit';
};

function personInMeeting(m: any, pid: string): boolean {
  return (m.participants ?? []).some((x: any) => (x?.person?.id ?? x?.personId ?? '') === pid);
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [allPeople, setAllPeople] = useState<any[]>([]);
  const [rels, setRels] = useState<any[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [person, orgRows, tl, people, relList, orgList, contactsRes, meetingsRes, actionsRes] = await Promise.all([
        api(`/people/${id}`),
        api(`/people/${id}/organizations`),
        api(`/people/${id}/timeline`),
        api('/people'),
        api('/relationships'),
        api('/organizations'),
        api(`/core-domain/people/${id}/contacts`).catch(() => []),
        api<any>('/meetings').catch(() => []),
        api<any>('/actions').catch(() => []),
      ]);
      setP(person); setOrgs(arr(orgRows)); setTimeline(arr(tl)); setContacts(arr(contactsRes));
      setAllPeople(arr(people)); setRels(arr(relList)); setAllOrgs(arr(orgList));
      setMeetings(arr(meetingsRes)); setActions(arr(actionsRes));
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const orgId = p?.organizationId ?? orgs.find((o: any) => o.isPrimary)?.organizationId;
  const org = allOrgs.find((o: any) => o.id === orgId);
  const orgRels = rels.filter((r: any) => r.sourceOrganizationId === orgId || r.targetOrganizationId === orgId);
  const colleagues = allPeople.filter((x: any) => x.id !== id && x.organizationId === orgId).slice(0, 6);

  const graphNodes: EgoNode[] = useMemo(() => {
    const nodes: EgoNode[] = [];
    orgRels.slice(0, 10).forEach((r: any) => {
      const otherId = r.sourceOrganizationId === orgId ? r.targetOrganizationId : r.sourceOrganizationId;
      const other = allOrgs.find((o: any) => o.id === otherId);
      if (!other) return;
      nodes.push({
        id: other.id, name: other.name, kind: 'organization', sub: other.type,
        status: r.status, score: 100 - (r.riskScore ?? 30),
        href: `/organizations/${other.id}`,
      });
    });
    colleagues.forEach((c: any) => {
      nodes.push({
        id: c.id, name: `${c.firstName} ${c.lastName ?? ''}`, kind: 'person',
        sub: c.title ?? 'همکار', edgeStyle: 'dashed', score: c.influenceScore ?? 60,
        href: `/people/${c.id}`,
      });
    });
    return nodes;
  }, [orgRels, colleagues, allOrgs, orgId]);

  const suggestions = useMemo(() => {
    if (!orgId || !allOrgs.length || !allPeople.length || !rels.length) return [];
    return suggestConnections(orgId, { orgs: allOrgs, people: allPeople, rels, interactions: [] }, new Set([id])).slice(0, 3);
  }, [orgId, allOrgs, allPeople, rels, id]);

  /* ---- وضعیت همکاری: جلسات پیشِ رو + اقدامات باز این شخص ---- */
  const collab = useMemo(() => {
    const now = Date.now();
    const upcoming = meetings
      .filter((m: any) => personInMeeting(m, id) && new Date(m.startAt).getTime() > now)
      .sort((a: any, b: any) => a.startAt.localeCompare(b.startAt));
    const openActs = actions
      .filter((a: any) => a.ownerId === id && !DONE_STATUSES.includes(a.status ?? ''))
      .sort((a: any, b: any) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'));
    const pastMeetings = meetings
      .filter((m: any) => personInMeeting(m, id) && new Date(m.startAt).getTime() <= now)
      .sort((a: any, b: any) => b.startAt.localeCompare(a.startAt));
    const maxPrio = Math.max(0, ...openActs.map((a: any) => a.priority === 'CRITICAL' ? 3 : a.priority === 'HIGH' ? 2 : a.priority === 'MEDIUM' ? 1 : 0));
    return { upcoming, openActs, lastMeetingAt: pastMeetings[0]?.startAt ?? null, maxPrio };
  }, [meetings, actions, id]);

  if (!p && !error) return <main className="feature-page"><PageHeader eyebrow="اشخاص" title="شخص" description="" actions={<></>} /><Loading /></main>;

  const displayName = `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim() || 'شخص';
  const initials = `${p?.firstName?.[0] ?? ''}${p?.lastName?.[0] ?? ''}` || '؟';
  const infoRows: Array<[string, string]> = [];
  if (p?.email) infoRows.push(['ایمیل', p.email]);
  if (p?.phone) infoRows.push(['تلفن', p.phone]);
  if (p?.title) infoRows.push(['سمت', p.title]);
  if (p?.department) infoRows.push(['بخش', p.department]);
  if (p?.country) infoRows.push(['کشور', p.country]);
  if (p?.status) infoRows.push(['وضعیت', fa(p.status)]);
  const tlTone = (k: string): any =>
    k === 'MEETING' ? 'success' : k === 'ACTION' ? 'warning' : k === 'INTERACTION' ? 'info' : 'neutral';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="اشخاص · پروفایل"
        title={displayName}
        description={[p?.title, p?.department].filter(Boolean).join(' · ') || 'بدون سمت'}
        actions={
          <div className="toolbar">
            {org && <Link className="secondary-action" href={`/organizations/${org.id}`}><Building2 size={14} /> {org.name}</Link>}
            <button className="secondary-action" onClick={load}>بازخوانی</button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {p && (
        <>
          {/* profile strip */}
          <section className="profile-strip">
            <span className="avatar avatar-lg">{initials}</span>
            <div className="profile-main">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2>{displayName}</h2>
                <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{fa(p.status ?? 'ACTIVE')}</Badge>
                {org && <Link className="chip info" href={`/organizations/${org.id}`}><Building2 size={12} /> {org.name}</Link>}
              </div>
              <p>{p.title ?? 'بدون سمت'}{p.department ? ` · ${p.department}` : ''}</p>
            </div>
            <div className="profile-metrics">
              <span className="person-score"><Star size={13} /><b className={scoreCls(p.influenceScore) === 'h-hi' ? 'hi' : scoreCls(p.influenceScore) === 'h-mid' ? 'mid' : 'lo'}>{fmtNum(p.influenceScore)}</b><small>نفوذ</small></span>
              <span className="person-score"><Crown size={13} /><b className="mid">{fmtNum(p.decisionPower)}</b><small>قدرت تصمیم</small></span>
              <span className="person-score"><UserCheck size={13} /><b className="mid">{fmtNum(p.accessibilityScore)}</b><small>دسترس‌پذیری</small></span>
            </div>
          </section>

          {/* وضعیت همکاری — پاسخ به «این شخص الان چه وضعیتی دارد؟» */}
          <section className="rel-status-card">
            <div className="rel-status-head">
              <span className="rel-status-ico"><HeartPulse size={17} /></span>
              <div>
                <h2>وضعیت همکاری با این شخص</h2>
                <p>بر پایهٔ امتیازهای شخص، جلسات آینده و اقدامات در انتظار او — محاسبهٔ زنده از داده‌های واقعی</p>
              </div>
              {(collab.openActs.length > 0 || collab.upcoming.length > 0) && (
                <Badge tone="info">{fmtNum(collab.upcoming.length)} جلسه · {fmtNum(collab.openActs.length)} اقدام باز</Badge>
              )}
            </div>

            <div className="rel-status-metrics">
              <div className="rel-metric">
                <span>نفوذ</span>
                <div className="rel-metric-value"><b className={scoreCls(p.influenceScore)}>{fmtNum(p.influenceScore)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={scoreCls(p.influenceScore)} style={{ width: `${p.influenceScore ?? 0}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>قدرت تصمیم</span>
                <div className="rel-metric-value"><b className={scoreCls(p.decisionPower)}>{fmtNum(p.decisionPower)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={scoreCls(p.decisionPower)} style={{ width: `${p.decisionPower ?? 0}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>دسترس‌پذیری</span>
                <div className="rel-metric-value"><b className={scoreCls(p.accessibilityScore)}>{fmtNum(p.accessibilityScore)}</b><small>از ۱۰۰</small></div>
                <div className="rel-metric-bar"><span className={scoreCls(p.accessibilityScore)} style={{ width: `${p.accessibilityScore ?? 0}%` }} /></div>
              </div>
              <div className="rel-metric">
                <span>جلسهٔ بعدی</span>
                <div className="rel-metric-value">
                  <b>{collab.upcoming[0] ? fmtNum(new Date(collab.upcoming[0].startAt).getDate()) : '—'}</b>
                  <small>{collab.upcoming[0] ? new Date(collab.upcoming[0].startAt).toLocaleDateString('fa-IR', { month: 'short' }) : 'جلسه‌ای ثبت نشده'}</small>
                </div>
                {collab.upcoming[0] && <div className="rel-metric-note">{collab.upcoming[0].title}</div>}
              </div>
              <div className="rel-metric">
                <span>اقدامات در انتظار</span>
                <div className="rel-metric-value"><b className={collab.maxPrio >= 3 ? 'h-crit' : collab.maxPrio === 2 ? 'h-low' : ''}>{fmtNum(collab.openActs.length)}</b><small>مورد باز</small></div>
                {collab.openActs[0] && <div className="rel-metric-note">{collab.openActs[0].title}</div>}
              </div>
            </div>

            {(collab.upcoming.length > 0 || collab.openActs.length > 0) && (
              <div className="rel-status-list">
                {collab.upcoming.slice(0, 3).map((m: any) => (
                  <Link className="rel-status-row" href={`/meetings/${m.id}`} key={`m-${m.id}`}>
                    <span className="health-dot s" style={{ background: 'var(--srip-accent)' }} />
                    <span className="rel-status-row-name">{m.title}</span>
                    <span className="rel-status-row-bar" style={{ width: 'auto', border: 0, background: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CalendarDays size={13} style={{ color: 'var(--text-muted)' }} />
                      <b className="t-num" style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11.5 }}>{fmtDate(m.startAt)}</b>
                    </span>
                    <Badge tone="info">جلسهٔ پیشِ رو</Badge>
                  </Link>
                ))}
                {collab.openActs.slice(0, 3).map((a: any) => (
                  <Link className="rel-status-row" href={`/actions/${a.id}`} key={`a-${a.id}`}>
                    <span className={`health-dot ${a.priority === 'CRITICAL' ? 'h-crit' : a.priority === 'HIGH' ? 'h-low' : 'h-mid'}`} />
                    <span className="rel-status-row-name">{a.title}</span>
                    <span className="rel-status-row-bar" style={{ width: 'auto', border: 0, background: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {a.dueAt ? <AlarmClock size={13} style={{ color: 'var(--text-muted)' }} /> : <Zap size={13} style={{ color: 'var(--text-muted)' }} />}
                      <b className="t-num" style={{ color: 'var(--text-secondary)', fontWeight: 700, fontSize: 11.5 }}>{a.dueAt ? fmtDate(a.dueAt) : 'بدون موعد'}</b>
                    </span>
                    <Badge tone={a.priority === 'CRITICAL' ? 'danger' : a.priority === 'HIGH' ? 'warning' : 'neutral'}>{fa(a.status)}{a.priority ? ` · ${fa(a.priority)}` : ''}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="split-panels">
            {/* Ego graph */}
            <section className="panel graph-panel">
              <div className="panel-title">
                <div><h2>گراف ارتباطات {displayName}</h2><p>سازمان‌های در ارتباط + همکاران — با وضعیت رابطه</p></div>
                <Link className="btn btn-ghost btn-sm" href="/network">شبکهٔ کامل ←</Link>
              </div>
              <EgoGraph center={{ name: displayName, kind: 'person', sub: org?.name ?? '' }} centerHref={`/people/${id}`} nodes={graphNodes} height={330} />
            </section>

            {/* Info + org */}
            <section className="panel">
              <div className="panel-title"><div><h2>اطلاعات شخص</h2><p>داده‌های اصلی پروفایل</p></div></div>
              <div className="detail-grid">
                {infoRows.map(([k, v]) => (
                  <div className="detail-item" key={k}><small>{k}</small><strong>{v}</strong></div>
                ))}
                {infoRows.length === 0 && <p className="empty-state">داده‌ای ثبت نشده است.</p>}
              </div>
              <div className="panel-title" style={{ marginTop: 20 }}><div><h2>سازمان‌ها و نقش‌ها</h2><Badge>{fmtNum(orgs.length)}</Badge></div></div>
              {orgs.length ? (
                <div className="list">
                  {orgs.map((o: any) => (
                    <div className="listRow" key={o.organizationId}>
                      <Badge tone={o.isPrimary ? 'success' : 'neutral'}>{o.isPrimary ? 'اصلی' : fa(o.status ?? 'ACTIVE')}</Badge>
                      <span><strong>{o.organization?.name ?? o.organizationId}</strong><small>{[o.roleTitle, o.department].filter(Boolean).join(' · ') || 'بدون نقش'}</small></span>
                    </div>
                  ))}
                </div>
              ) : <p className="empty-state">انتساب سازمانی ثبت نشده است.</p>}
            </section>
          </div>

          <div className="split-panels">
            {/* Contacts */}
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
              ) : <p className="empty-state"><Mail size={18} /> تماسی ثبت نشده است.</p>}
            </section>

            {/* Suggestions */}
            <section className="panel">
              <div className="panel-title"><div><h2>پیشنهاد ارتباط جدید</h2><p>بر اساس شبکهٔ سازمان «{org?.name ?? ''}»</p></div></div>
              {suggestions.length ? (
                <div className="list">
                  {suggestions.map((s) => (
                    <Link className="listRow linkable" href={s.href} key={s.id} style={{ textDecoration: 'none' }}>
                      <span className="stat-ico ic-purple" style={{ width: 30, height: 30, borderRadius: 9, flex: 'none' }}><Link2 size={14} /></span>
                      <span style={{ flex: 1 }}>
                        <strong>{s.name} <span className="confidence-num">{fmtNum(s.score)}٪</span></strong>
                        <small>{s.reasons.slice(0, 2).join(' · ')}</small>
                      </span>
                      <ChevronLeft size={14} className="muted" />
                    </Link>
                  ))}
                </div>
              ) : <p className="empty-state"><Sparkles size={18} /> پیشنهادی برای این شبکه موجود نیست.</p>}
            </section>
          </div>

          {/* Timeline */}
          <section className="panel">
            <div className="panel-title"><div><h2>خط زمانی</h2><p>جلسات، تعاملات و اقدامات</p></div><Badge>{fmtNum(timeline.length)}</Badge></div>
            {timeline.length ? (
              <div className="list">
                {timeline.slice(0, 50).map((x: any, i: number) => (
                  <div className="listRow" key={x.id ?? i}>
                    <Badge tone={tlTone(x.kind ?? '')}>{fa(x.kind ?? 'EVENT')}</Badge>
                    <span><strong>{x.title || x.subject || x.description || x.name || x.eventType || '—'}</strong>
                      {(x.date || x.createdAt) ? <small><CalendarDays size={11} style={{ verticalAlign: '-1px' }} /> {new Date(x.date ?? x.createdAt).toLocaleString('fa-IR')}</small> : null}</span>
                    {x.status && <Badge tone={x.status === 'DONE' ? 'success' : x.status === 'UPCOMING' ? 'info' : x.status === 'OPEN' ? 'warning' : 'neutral'}>{fa(x.status)}</Badge>}
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">رویدادی ثبت نشده است.</p>}
          </section>
        </>
      )}
    </main>
  );
}
