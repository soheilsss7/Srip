'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { ErrorCard, Loading, Modal, Badge } from '../_components/page-ui';
import { t } from '../_lib/i18n';
import {
  JALALI_MONTHS, WEEKDAYS_SAT, faNum, todayJalali, toJalali, toGregorian,
  jalaaliMonthLength, saturdayFirst, toJalaliKey, faFullDate,
} from '../_lib/jalali';
import {
  CalendarDays, ChevronRight, ChevronLeft, Plus, Clock, MapPin, RefreshCw, Building2,
  Megaphone, ListChecks, Siren, ShieldAlert, CheckCircle2, AlertTriangle,
} from 'lucide-react';

type Meeting = {
  id: string;
  title: string;
  startAt: string;
  endAt?: string | null;
  objective?: string | null;
  outcome?: string | null;
  location?: string | null;
  organization?: { id: string; name: string } | null;
  participants?: Array<{ person?: { id: string; firstName: string; lastName: string } }>;
};

const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

/** نمونهٔ کوتاه روز هفته برای نمایشگرهای باریک (ش، ی، د، س، چ، پ، ج) */
const DOW_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/* ═══ گام ۲.۶ مسترپلن — معماری رویدادها (بخش ۱۷ سند؛ فرم ۱۰) ═══
   رویدادها دو مسیر مستقل دارند: مالکیت (شاخص مرجعیت) و حضور بیرونی (شاخص
   شبکه‌سازی)؛ خروجی، تقویم رویدادهای سالانه است. هر رویداد با چک‌لیست
   هفت‌مرحله‌ای کنترل می‌شود و پروتکل بحران با واکنش طلایی ۲ ساعتی کنارش است. */
const PATH_FA: Record<string, string> = { OWNED: t('مالکیت'), ATTEND: t('حضور بیرونی') };
const STEP_STATUS_FA: Record<string, string> = { DONE: t('انجام‌شده'), CURRENT: t('مرحلهٔ جاری'), PENDING: t('در انتظار') };
const CRISIS_STATUS_FA: Record<string, string> = { ACTIVE: t('فعال'), RESOLVED: t('رفع‌شده') };

const jDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return `${faNum(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${faNum(j.jy)}`;
};

export default function CalendarPage() {
  const now = todayJalali();
  const { scopeId, can } = useWorkspace();
  const writable = can('publics.write');
  const [jy, setJy] = useState(now.jy);
  const [jm, setJm] = useState(now.jm);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [evMeta, setEvMeta] = useState<any>(null);
  const [crisis, setCrisis] = useState<any>(null);
  const [scopeName, setScopeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /* مودال‌های گام ۲.۶ */
  const [evFormOpen, setEvFormOpen] = useState(false);
  const [evForm, setEvForm] = useState({ title: '', path: 'OWNED', kind: 'thinkTankRoundtable', attendType: 'keynote', eventAt: '', ownerRole: '', notes: '' });
  const [checklist, setChecklist] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisForm, setCrisisForm] = useState({ title: '', detectedAt: '', firstResponseAt: '', notes: '' });
  /* گام ۴.۲ — فرم ۸ و ۷: تقویم انتشار رسانه تخصصی + گردش تأیید محتوا */
  const [content, setContent] = useState<any>(null);
  const [contentSel, setContentSel] = useState<any>(null);
  const [contentFormOpen, setContentFormOpen] = useState(false);
  const programWritable = can('program.write');
  const nowD = new Date();
  const monthNow = `${nowD.getFullYear()}-${String(nowD.getMonth() + 1).padStart(2, '0')}`;
  const emptyContentForm = { title: '', pillar: 'newsroom', month: monthNow, ownerRole: 'مدیر محتوا' };
  const [contentForm, setContentForm] = useState(emptyContentForm);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '';
      const [ms, evs, cr, cnt] = await Promise.all([
        api(`/meetings${qs}`),
        api('/events'),
        api('/crisis-protocol').catch(() => null),
        api('/program/content').catch(() => null),
      ]);
      setMeetings(unwrap(ms));
      setEvents(unwrap(evs) ?? []);
      setEvMeta(evs ?? null);
      if (cr) setCrisis(cr);
      if (cnt) setContent(cnt);
      if (scopeId !== 'all' && !scopeName) {
        try {
          const orgs = unwrap(await api('/organizations'));
          const hit = orgs.find((o: any) => o.id === scopeId);
          if (hit) setScopeName(hit.name);
        } catch {}
      }
    }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [scopeId, scopeName]);
  useEffect(() => { load(); }, [load]);

  const byKey = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const d = new Date(m.startAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = toJalaliKey(d);
      const list = map.get(k) ?? [];
      list.push(m);
      map.set(k, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [meetings]);

  /* رویدادهای سالانه روی روزهای تقویم */
  const evByKey = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of events) {
      const d = new Date(e.eventAt);
      if (Number.isNaN(d.getTime())) continue;
      const k = toJalaliKey(d);
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.eventAt.localeCompare(b.eventAt));
    return map;
  }, [events]);

  // Grid: Saturday-first, 6 rows × 7 cols
  /* گام ۴.۲ — ثبت نتیجهٔ کنترل فرم ۷ و انتشار خروجی تأییدشده */
  const reloadContent = async () => { try { setContent(await api('/program/content')); } catch {} };
  const registerControl = async (item: any, key: string) => {
    setBusy(true);
    try {
      const upd = await api(`/program/content/${item.id}/controls/${key}`, { method: 'POST', body: JSON.stringify({ ok: true }) });
      setContentSel(upd); await reloadContent();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const publishContent = async (item: any) => {
    setBusy(true);
    try {
      const upd = await api(`/program/content/${item.id}/publish`, { method: 'POST' });
      setContentSel(upd); await reloadContent();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const saveContent = async () => {
    setBusy(true);
    try {
      await api('/program/content', { method: 'POST', body: JSON.stringify(contentForm) });
      setContentFormOpen(false); setContentForm(emptyContentForm); await reloadContent();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const grid = useMemo(() => {
    const first = toGregorian(jy, jm, 1);
    const offset = saturdayFirst(first.gy, first.gm, first.gd); // 0=شنبه
    const daysInMonth = jalaaliMonthLength(jy, jm);
    const cells: Array<{ jd: number; key: string; date?: Date } | null> = [];
    for (let i = 0; i < 42; i++) {
      const jd = i + 1 - offset;
      if (jd < 1 || jd > daysInMonth) { cells.push(null); continue; }
      const g = toGregorian(jy, jm, jd);
      cells.push({ jd, key: `${jy}-${jm}-${jd}`, date: new Date(g.gy, g.gm - 1, g.gd) });
    }
    return cells;
  }, [jy, jm]);

  const todayKey = useMemo(() => {
    const n = new Date();
    return toJalaliKey(n);
  }, []);

  const nav = (dir: 1 | -1) => {
    let m = jm + dir;
    let y = jy;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setJm(m); setJy(y);
  };

  const goToday = () => { setJy(now.jy); setJm(now.jm); };

  const monthMeetings = useMemo(
    () => meetings.filter(m => { const k = toJalaliKey(new Date(m.startAt)); return k.startsWith(`${jy}-${jm}-`); }),
    [meetings, jy, jm],
  );
  const monthEvents = useMemo(
    () => events.filter(e => { const k = toJalaliKey(new Date(e.eventAt)); return k.startsWith(`${jy}-${jm}-`); }),
    [events, jy, jm],
  );
  const upcoming = useMemo(() =>
    [...meetings]
      .filter(m => new Date(m.startAt).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 7),
    [meetings],
  );
  const upcomingEvents = useMemo(() =>
    [...events]
      .filter(e => new Date(e.eventAt).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => a.eventAt.localeCompare(b.eventAt))
      .slice(0, 6),
    [events],
  );
  const activeCrises = (crisis?.crises ?? []).filter((c: any) => c.status === 'ACTIVE');

  const timeOf = (iso: string) => {
    const d = new Date(iso);
    return faNum(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  };

  /* ── ثبت رویداد (فرم ۱۰) ── */
  const openEventForm = () => {
    setEvForm(f => ({ ...f, title: '', eventAt: '', ownerRole: '', notes: '' }));
    setEvFormOpen(true);
  };
  const saveEvent = async () => {
    setBusy(true);
    try {
      const body: any = {
        title: evForm.title, path: evForm.path, ownerRole: evForm.ownerRole,
        eventAt: new Date(evForm.eventAt).toISOString(), notes: evForm.notes,
      };
      if (evForm.path === 'OWNED') body.kind = evForm.kind; else body.attendType = evForm.attendType;
      await api('/events', { method: 'POST', body: JSON.stringify(body) });
      setEvFormOpen(false); await load();
    } catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  /* ── تکمیل مرحلهٔ چک‌لیست ── */
  const doneStep = async (ev: any, stepKey: string) => {
    setBusy(true);
    try {
      const updated = await api(`/events/${ev.id}/steps/${stepKey}`, { method: 'POST' });
      setChecklist(updated); await load();
    } catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  /* ── بحران ── */
  const saveCrisis = async () => {
    setBusy(true);
    try {
      const body: any = {
        title: crisisForm.title, notes: crisisForm.notes,
        detectedAt: crisisForm.detectedAt ? new Date(crisisForm.detectedAt).toISOString() : new Date().toISOString(),
      };
      if (crisisForm.firstResponseAt) body.firstResponseAt = new Date(crisisForm.firstResponseAt).toISOString();
      const upd = await api('/crisis-protocol/crises', { method: 'POST', body: JSON.stringify(body) });
      setCrisis(upd); setCrisisOpen(false); setCrisisForm({ title: '', detectedAt: '', firstResponseAt: '', notes: '' });
    } catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };
  const respondNow = async (c: any) => {
    setBusy(true);
    try { setCrisis(await api(`/crisis-protocol/crises/${c.id}`, { method: 'PATCH', body: JSON.stringify({ firstResponseAt: new Date().toISOString() }) })); }
    catch (x: any) { setError(x?.message ?? String(x)); } finally { setBusy(false); }
  };

  const ownedKinds = evMeta?.ownedKinds ?? [];
  const attendTypes = evMeta?.attendTypes ?? [];
  const evFormKindOptions = evForm.path === 'OWNED' ? ownedKinds : attendTypes;

  return (
    <main className="feature-page">
      <section className="page-heading">
        <div>
          <h1>{t('تقویم جلسات و رویدادها')}</h1>
          <p className="subtitle">{t('نمای ماهانهٔ جلالی جلسات و رویدادهای سالانه — هر روز جلسات، رویداد و وضعیت نتیجه را نشان می‌دهد؛ هر رویداد با چک‌لیست هفت‌مرحله‌ای کنترل می‌شود.')}</p>
        </div>
        <div className="heading-tools">
          {writable && <button className="primary-action" onClick={openEventForm}><Plus size={14}/> {t('رویداد جدید')}</button>}
          <Link className="secondary-action" href="/meetings"><Plus size={14}/> جلسهٔ جدید</Link>
        </div>
      </section>

      <ErrorCard message={error} />
      {loading ? <Loading /> : (
        <div className="cal-layout">
          {/* Calendar */}
          <section className="panel cal-panel">
            <div className="cal-head">
              <div className="cal-title">
                <span className="stat-ico ic-indigo" style={{ width: 34, height: 34, borderRadius: 10 }}><CalendarDays size={16}/></span>
                <h2>{JALALI_MONTHS[jm - 1]} {faNum(jy)}</h2>
                <span className="chip neutral">{faNum(monthMeetings.length)} جلسه در این ماه</span>
                <span className="chip purple">{faNum(monthEvents.length)} {t('رویداد در این ماه')}</span>
                {scopeId !== 'all' && <span className="chip info">محدوده: {scopeName || scopeId.slice(0, 8)}</span>}
              </div>
              <div className="cal-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => nav(1)} aria-label="ماه بعد"><ChevronRight size={16}/></button>
                <button className="btn btn-ghost btn-sm" onClick={goToday}>امروز</button>
                <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} aria-label="ماه قبل"><ChevronLeft size={16}/></button>
              </div>
            </div>

            <div className="cal-grid" role="grid" aria-label={`تقویم ${JALALI_MONTHS[jm - 1]} ${faNum(jy)}`}>
              {WEEKDAYS_SAT.map((w, i) => (
                <div className="cal-dow" key={w}><span className="dow-f">{w}</span><span className="dow-s">{DOW_SHORT[i]}</span></div>
              ))}
              {grid.map((cell, i) => {
                if (!cell) return <div className="cal-cell blank" key={i} />;
                const list = byKey.get(cell.key) ?? [];
                const evs = evByKey.get(cell.key) ?? [];
                const isToday = cell.key === todayKey;
                const hasOutcome = list.some(m => m.outcome);
                return (
                  <div className={`cal-cell${isToday ? ' today' : ''}${list.length || evs.length ? ' has-events' : ''}`} key={i} role="gridcell">
                    <span className={`cal-day${isToday ? ' today' : ''}`}>{faNum(cell.jd)}</span>
                    <div className="cal-events">
                      {evs.slice(0, 2).map(e => (
                        <button type="button" className="cal-event cal-ev-row" key={e.id} onClick={() => setChecklist(e)} title={`${e.title} — ${e.path === 'OWNED' ? e.kindLabel : e.attendLabel}`}>
                          <span className={`cal-event-dot ev-dot ${e.path === 'OWNED' ? 'ev-owned' : 'ev-attend'}`} />
                          <span className="cal-event-time">{timeOf(e.eventAt)}</span>
                          <span className="cal-event-title">{e.title}</span>
                        </button>
                      ))}
                      {list.slice(0, 3).map(m => (
                        <Link className="cal-event" href={`/meetings/${m.id}`} key={m.id} title={`${m.title} — ${timeOf(m.startAt)}`}>
                          <span className="cal-event-dot" style={{ background: m.outcome ? 'var(--srip-success)' : m.organization?.name ? 'var(--srip-accent)' : 'var(--text-muted)' }} />
                          <span className="cal-event-time">{timeOf(m.startAt)}</span>
                          <span className="cal-event-title">{m.title}</span>
                        </Link>
                      ))}
                      {(list.length + evs.length) > 4 && <span className="cal-more">+{faNum(list.length + evs.length - 4)} {t('مورد دیگر')}</span>}
                    </div>
                    {hasOutcome && <span className="cal-outcome-chip">نتیجه ثبت شده</span>}
                  </div>
                );
              })}
            </div>
            <div className="cal-legend">
              <span><i className="ev-dot ev-owned"/> {t('رویداد مالکیتی')}</span>
              <span><i className="ev-dot ev-attend"/> {t('حضور بیرونی')}</span>
              <span><i className="ev-dot" style={{ background: 'var(--srip-accent)' }}/> جلسه</span>
            </div>
          </section>

          {/* Side panel */}
          <aside className="cal-side">
            <section className="panel">
              <div className="panel-title"><div><h2>{t('رویدادهای پیشِ رو')}</h2><p>{t('تقویم رویدادهای سالانه — دو مسیر مالکیت و حضور')}</p></div></div>
              {upcomingEvents.length === 0 ? <p className="empty-state">{t('رویدادی پیشِ رو نیست.')}</p> : (
                <div className="list">
                  {upcomingEvents.map(e => (
                    <button type="button" className="listRow linkable ev-row" key={e.id} onClick={() => setChecklist(e)} style={{ textAlign: 'right', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong className="ellipsis">{e.title}</strong>
                        <small style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className={`chip ${e.path === 'OWNED' ? 'purple' : 'teal'}`}>{PATH_FA[e.path]}</span>
                          {e.path === 'OWNED' ? e.kindLabel : e.attendLabel}
                          {' · '}
                          <Clock size={11} style={{ verticalAlign: '-1px' }}/> {jDate(e.eventAt)}
                        </small>
                        <span className="ev-progress" aria-label={t('پیشرفت چک‌لیست هفت‌مرحله‌ای')}>
                          <i style={{ width: `${(e.stepsDoneCount / e.stepsTotal) * 100}%` }} />
                        </span>
                      </span>
                      <span className="ev-steps-badge">
                        {faNum(e.stepsDoneCount)}/{faNum(e.stepsTotal)}
                        {e.overdueSteps > 0 && <em title={t('مراحل عقب‌افتاده')}><AlertTriangle size={12} /></em>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-title"><div><h2>جلسات پیشِ رو</h2><p>۷ مورد بعدی در محدودهٔ شما</p></div></div>
              {upcoming.length === 0 ? <p className="empty-state">جلسه‌ای پیشِ رو نیست.</p> : (
                <div className="list">
                  {upcoming.map(m => {
                    const d = new Date(m.startAt);
                    const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                    return (
                      <Link className="listRow linkable" href={`/meetings/${m.id}`} key={m.id} style={{ textDecoration: 'none' }}>
                        <span className="cal-mini-date">
                          <strong>{faNum(j.jd)}</strong>
                          <small>{JALALI_MONTHS[j.jm - 1].slice(0, 6)}</small>
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong className="ellipsis">{m.title}</strong>
                          <small style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Clock size={11} style={{ verticalAlign: '-1px' }}/> {timeOf(m.startAt)}
                            {m.organization?.name && <><Building2 size={11}/> {m.organization.name}</>}
                          </small>
                        </span>
                        {m.outcome ? <span className="chip success">انجام شد</span> : <span className="chip warning">پیشِ رو</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* پروتکل ارتباط بحران — گام ۲.۶ (۱۱.۵ سند) */}
            <section className="panel crisis-panel">
              <div className="panel-title">
                <div><h2>{t('پروتکل ارتباط بحران')}</h2><p>{t('واکنش طلایی حداکثر ۲ ساعت — پیام اولیه از پیش آماده')}</p></div>
                {writable && <button className="btn btn-ghost btn-sm" onClick={() => { setCrisisForm({ title: '', detectedAt: '', firstResponseAt: '', notes: '' }); setCrisisOpen(true); }}><Siren size={13}/> {t('ثبت بحران')}</button>}
              </div>
              {crisis ? (
                <>
                  <div className="crisis-roles">
                    <span className="detail-item"><small>{t('سخنگوی رسمی')}</small><strong>{crisis.spokesperson || '—'}</strong></span>
                    <span className="detail-item"><small>{t('جانشین سخنگو')}</small><strong>{crisis.backup || '—'}</strong></span>
                    <span className="detail-item"><small>{t('زمان واکنش طلایی')}</small><strong>{faNum(crisis.goldenHours)} {t('ساعت')}</strong></span>
                    <span className="detail-item"><small>{t('پیام‌های اولیهٔ آماده')}</small><strong>{faNum((crisis.messages ?? []).length)}</strong></span>
                  </div>
                  {activeCrises.length > 0 && (
                    <p className="notice crisis-live" role="status">
                      <ShieldAlert size={14}/> {t('بحران فعال در جریان است — واکنش اولیه را ثبت کنید.')}
                    </p>
                  )}
                  <div className="list">
                    {(crisis.crises ?? []).length === 0 ? <p className="empty-state">{t('بحرانی ثبت نشده است.')}</p> : (crisis.crises ?? []).map((c: any) => (
                      <div className="listRow crisis-row" key={c.id}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <strong className="ellipsis">{c.title}</strong>
                          <small>{t('شناسایی')}: {jDate(c.detectedAt)}</small>
                        </span>
                        <span className="crisis-badges">
                          <Badge tone={c.status === 'ACTIVE' ? 'danger' : 'success'}>{CRISIS_STATUS_FA[c.status]}</Badge>
                          {c.reactionHours != null && (
                            <Badge tone={c.withinGolden ? 'success' : 'warning'}>
                              {t('واکنش')} {faNum(c.reactionHours)} {t('ساعت')} {c.withinGolden ? t('· طلایی') : t('· دیرتر از طلایی')}
                            </Badge>
                          )}
                          {writable && c.status === 'ACTIVE' && !c.firstResponseAt && (
                            <button type="button" className="srip-button" disabled={busy} onClick={() => respondNow(c)}>{t('ثبت پاسخ (الان)')}</button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="empty-state">{t('پروتکل بحران در دسترس نیست.')}</p>}
            </section>

            <section className="panel">
              <div className="panel-title"><div><h2>امروز</h2><p>{JALALI_MONTHS[now.jm - 1]} {faNum(now.jd)}</p></div></div>
              {(byKey.get(todayKey) ?? []).length === 0 && (evByKey.get(todayKey) ?? []).length === 0 ? (
                <p className="empty-state"><CalendarDays size={18}/> {t('جلسه یا رویدادی برای امروز نیست.')}</p>
              ) : (
                <div className="list">
                  {(evByKey.get(todayKey) ?? []).map(e => (
                    <button type="button" className="listRow linkable" key={e.id} onClick={() => setChecklist(e)} style={{ textAlign: 'right', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <span style={{ flex: 1 }}><strong>{e.title}</strong><small>{PATH_FA[e.path]} · {e.path === 'OWNED' ? e.kindLabel : e.attendLabel}</small></span>
                      <ListChecks size={14} className="muted" />
                    </button>
                  ))}
                  {(byKey.get(todayKey) ?? []).map(m => (
                    <Link className="listRow linkable" href={`/meetings/${m.id}`} key={m.id} style={{ textDecoration: 'none' }}>
                      <span style={{ flex: 1 }}><strong>{m.title}</strong><small>{timeOf(m.startAt)}{m.location ? ` · ${m.location}` : ''}</small></span>
                      <ChevronLeft size={14} className="muted" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13}/> بازخوانی</button>
      </div>
      {/* ═══ گام ۴.۲ — فرم ۸ و ۷: رسانه تخصصی و تأیید محتوا ═══ */}
      {content && (
        <section className="panel content-panel">
          <div className="panel-title">
            <div>
              <h2>{t('رسانه تخصصی و تأیید محتوا (فرم ۸ و ۷)')}</h2>
              <p>{t('هفت ستون رسانه تخصصی با ریتم انتشار؛ هر خروجی عمومی پیش از انتشار، گردش تأیید سه‌مرحله‌ای با چهار کنترل الزامی را طی می‌کند.')}</p>
            </div>
            <div className="toolbar">
              {programWritable && <button className="btn btn-ghost btn-sm" onClick={() => { setContentForm(emptyContentForm); setContentFormOpen(true); }}>{t('خروجی رسانه‌ای تازه')}</button>}
            </div>
          </div>
          <div className="pmr-stats">
            <span className="chip success">{t('منتشرشده')}: {faNum(content.stats.published)}</span>
            <span className="chip info">{t('تأییدشده')}: {faNum(content.stats.approved)}</span>
            <span className="chip warning">{t('در بازبینی')}: {faNum(content.stats.inReview)}</span>
            <span className="chip neutral">{t('پیش‌نویس')}: {faNum(content.stats.draft)}</span>
            <span className="chip neutral">{t('خروجی ماه جاری')}: {faNum(content.stats.thisMonth)}</span>
          </div>
          <div className="cnt-pillars">
            {content.pillars.map((p: any) => (
              <div key={p.key} className="cnt-pillar">
                <b>{t(p.title)}</b>
                <small>{t(p.rhythm)}</small>
                <span className="t-muted">{t(p.desc)}</span>
                <em>{t('این ماه')}: {faNum(p.thisMonth)} · {t('منتشرشده')}: {faNum(p.published)}</em>
              </div>
            ))}
          </div>
          <div className="cnt-list">
            {content.items.map((c: any) => (
              <button type="button" key={c.id} className={`cnt-row ${c.status}`} onClick={() => setContentSel(c)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{c.title}</strong>
                  <small>{t(c.pillarTitle)} · {t(c.pillarRhythm)} · {c.month} · {c.ownerRole}</small>
                </span>
                <span className="cnt-ctl-dots">
                  {content.controls.map((x: any) => (
                    <i key={x.key} className={c.controlsView[x.key]?.registered && c.controlsView[x.key]?.ok ? 'ok' : c.controlsView[x.key]?.registered ? 'bad' : ''} title={t(x.title)} />
                  ))}
                </span>
                <span className="pmr-badges">
                  <Badge tone={c.status === 'PUBLISHED' ? 'success' : c.status === 'APPROVED' ? 'info' : c.status === 'IN_REVIEW' ? 'warning' : 'neutral'}>{t(c.statusFa)}</Badge>
                </span>
              </button>
            ))}
            {!content.items.length && <p className="empty-state">{t('هنوز خروجی رسانه‌ای ثبت نشده است — از «خروجی رسانه‌ای تازه» آغاز کنید.')}</p>}
          </div>
        </section>
      )}


      {/* مودال رویداد جدید — فرم ۱۰ سند */}
      <Modal open={evFormOpen} title={t('ثبت رویداد در تقویم سالانه')} onClose={() => setEvFormOpen(false)}>
        <form id="event-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); saveEvent(); }}>
          <div className="field full">
            <label className="field-label">{t('عنوان رویداد')}</label>
            <input value={evForm.title} onChange={e => setEvForm(f => ({ ...f, title: e.target.value }))} placeholder={t('مثلاً: میزگرد داده و سیاست عمومی')} />
          </div>
          <div className="field">
            <label className="field-label">{t('مسیر رویداد')}</label>
            <select value={evForm.path} onChange={e => setEvForm(f => ({ ...f, path: e.target.value }))}>
              {(evMeta?.paths ?? []).map((p: any) => <option key={p.key} value={p.key}>{p.label} — {p.metric}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{evForm.path === 'OWNED' ? t('نوع رویداد مالکیتی') : t('نوع حضور بیرونی')}</label>
            <select value={evForm.path === 'OWNED' ? evForm.kind : evForm.attendType}
              onChange={e => setEvForm(f => (f.path === 'OWNED' ? { ...f, kind: e.target.value } : { ...f, attendType: e.target.value }))}>
              {evFormKindOptions.map((k: any) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          {evForm.path === 'ATTEND' && attendTypes.find((k: any) => k.key === evForm.attendType)?.requirement && (
            <p className="field-hint full">{t('الزام پیش از حضور')}: {attendTypes.find((k: any) => k.key === evForm.attendType)?.requirement}</p>
          )}
          {evForm.path === 'OWNED' && ownedKinds.find((k: any) => k.key === evForm.kind)?.scale && (
            <p className="field-hint full">{t('مقیاس')}: {ownedKinds.find((k: any) => k.key === evForm.kind)?.scale} · {t('هدف')}: {ownedKinds.find((k: any) => k.key === evForm.kind)?.goal}</p>
          )}
          <div className="field">
            <label className="field-label">{t('تاریخ و ساعت رویداد')}</label>
            <input type="datetime-local" required value={evForm.eventAt} onChange={e => setEvForm(f => ({ ...f, eventAt: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">{t('نقش مسئول (مالک رویداد)')}</label>
            <input value={evForm.ownerRole} onChange={e => setEvForm(f => ({ ...f, ownerRole: e.target.value }))} placeholder={t('مثلاً: مدیر رویداد')} />
          </div>
          <div className="field full">
            <label className="field-label">{t('یادداشت')}</label>
            <textarea rows={2} value={evForm.notes} onChange={e => setEvForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <p className="field-hint full">{t('با ثبت، مرحلهٔ ۱ چک‌لیست (ثبت در تقویم و ارزیابی ارزش حضور) خودکار تکمیل می‌شود.')}</p>
          <div className="form-actions">
            <button type="button" className="srip-button" onClick={() => setEvFormOpen(false)}>{t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت رویداد')}</button>
          </div>
        </form>
      </Modal>

      {/* مودال چک‌لیست هفت‌مرحله‌ای رویداد — فرم ۱۰ سند */}
      <Modal open={!!checklist} title={`${t('چک‌لیست رویداد')} — ${checklist?.title ?? ''}`} onClose={() => setChecklist(null)}>
        {checklist && (
          <div className="ev-checklist">
            <div className="ev-checklist-head">
              <Badge tone={checklist.path === 'OWNED' ? 'info' : 'neutral'}>{PATH_FA[checklist.path]}</Badge>
              <span>{checklist.path === 'OWNED' ? checklist.kindLabel : checklist.attendLabel}</span>
              <span>· {jDate(checklist.eventAt)}</span>
              <span>· {t('مسئول')}: {checklist.ownerRole}</span>
            </div>
            {checklist.attendRequirement && <p className="field-hint">{t('الزام پیش از حضور')}: {checklist.attendRequirement}</p>}
            <ol className="ev-steps-list">
              {checklist.steps.map((s: any) => (
                <li key={s.key} className={`ev-step ${s.status.toLowerCase()} ${s.overdue ? 'overdue' : ''}`}>
                  <span className="ev-step-no">{faNum(s.no)}</span>
                  <span style={{ flex: 1 }}>
                    <b>{s.label}</b>
                    <small>{s.when} · {t('موعد')}: {jDate(s.dueAt)}{s.overdue ? ` · ${t('عقب‌افتاده')}` : ''}</small>
                  </span>
                  {s.status === 'DONE' ? <CheckCircle2 size={16} className="t-success" /> : (
                    <Badge tone={s.status === 'CURRENT' ? 'info' : 'neutral'}>{STEP_STATUS_FA[s.status]}</Badge>
                  )}
                  {writable && s.status === 'CURRENT' && (
                    <button type="button" className="srip-button primary" disabled={busy} onClick={() => doneStep(checklist, s.key)}>{t('تکمیل مرحله')}</button>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Modal>

      {/* مودال ثبت بحران — ۱۱.۵ سند */}
      <Modal open={crisisOpen} title={t('ثبت بحران رسانه‌ای')} onClose={() => setCrisisOpen(false)}>
        <form id="crisis-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); saveCrisis(); }}>
          <div className="field full">
            <label className="field-label">{t('عنوان بحران')}</label>
            <input value={crisisForm.title} onChange={e => setCrisisForm(f => ({ ...f, title: e.target.value }))} placeholder={t('مثلاً: گزارش نادرست رسانه‌ای')} />
          </div>
          <div className="field">
            <label className="field-label">{t('زمان شناسایی')}</label>
            <input type="datetime-local" value={crisisForm.detectedAt} onChange={e => setCrisisForm(f => ({ ...f, detectedAt: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">{t('پاسخ اولیه (اگر صادر شده)')}</label>
            <input type="datetime-local" value={crisisForm.firstResponseAt} onChange={e => setCrisisForm(f => ({ ...f, firstResponseAt: e.target.value }))} />
          </div>
          <div className="field full">
            <label className="field-label">{t('یادداشت')}</label>
            <textarea rows={2} value={crisisForm.notes} onChange={e => setCrisisForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <p className="field-hint full">{t('سخنگو از پروتکل بحران ({spokesperson}) گرفته می‌شود؛ واکنش طلایی حداکثر {goldenHours} ساعت است.')
            .replace('{spokesperson}', crisis?.spokesperson ?? '—').replace('{goldenHours}', faNum(crisis?.goldenHours ?? 2))}</p>
          <div className="form-actions">
            <button type="button" className="srip-button" onClick={() => setCrisisOpen(false)}>{t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت بحران')}</button>
          </div>
        </form>
      </Modal>

      {/* گام ۴.۲ — مودال جزئیات خروجی: چهار کنترل فرم ۷ + انتشار */}
      <Modal open={!!contentSel} title={contentSel?.title ?? ''} onClose={() => setContentSel(null)}>
        {contentSel && (
          <div className="cnt-detail">
            <div className="cnt-detail-head">
              <Badge tone={contentSel.status === 'PUBLISHED' ? 'success' : contentSel.status === 'APPROVED' ? 'info' : contentSel.status === 'IN_REVIEW' ? 'warning' : 'neutral'}>{t(contentSel.statusFa)}</Badge>
              <span>{t(contentSel.pillarTitle)} · {t(contentSel.pillarRhythm)}</span>
              <small>{contentSel.month} · {contentSel.ownerRole}</small>
            </div>
            <div className="cnt-controls">
              <b className="bp-col-t">{t('گردش تأیید سه‌مرحله‌ای — چهار کنترل الزامی (فرم ۷)')}</b>
              {content.controls.map((x: any) => {
                const st = contentSel.controlsView[x.key];
                return (
                  <div key={x.key} className={`cnt-ctl ${st?.registered ? (st.ok ? 'ok' : 'bad') : ''}`}>
                    <span>{t(x.title)}</span>
                    {st?.registered
                      ? <small>{st.ok ? t('تأیید شد') : t('اصلاح لازم')}{st.at ? ` · ${faFullDate(new Date(st.at))}` : ''}</small>
                      : programWritable && contentSel.status !== 'PUBLISHED'
                        ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => registerControl(contentSel, x.key)}>{t('ثبت نتیجهٔ کنترل')}</button>
                        : <small className="t-muted">{t('ثبت نشده')}</small>}
                  </div>
                );
              })}
            </div>
            <p className="field-hint">{t('انتشار بدون تأیید کامل ممنوع است — هر چهار کنترل باید تأیید شده باشد؛ سپس «تأییدشده» و آمادهٔ انتشار می‌شود.')}</p>
            {programWritable && contentSel.status === 'APPROVED' && (
              <div className="form-actions">
                <button type="button" className="srip-button primary" disabled={busy} onClick={() => publishContent(contentSel)}>{t('انتشار')}</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* گام ۴.۲ — مودال خروجی رسانه‌ای تازه (فرم ۸) */}
      <Modal open={contentFormOpen} title={t('خروجی رسانه‌ای تازه (فرم ۸)')} onClose={() => setContentFormOpen(false)}>
        <form id="content-form" className="form-grid" onSubmit={(e) => { e.preventDefault(); saveContent(); }}>
          <div className="field full">
            <label className="field-label">{t('عنوان خروجی')}</label>
            <input required value={contentForm.title} onChange={(e) => setContentForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <label className="field-label">{t('ستون رسانه تخصصی')}</label>
            <select value={contentForm.pillar} onChange={(e) => setContentForm(f => ({ ...f, pillar: e.target.value }))}>
              {content?.pillars.map((p: any) => <option key={p.key} value={p.key}>{t(p.title)} — {t(p.rhythm)}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t('ماه انتشار (میلادی)')}</label>
            <input type="month" required value={contentForm.month} onChange={(e) => setContentForm(f => ({ ...f, month: e.target.value }))} />
          </div>
          <div className="field full">
            <label className="field-label">{t('مالک (نقش)')}</label>
            <input value={contentForm.ownerRole} onChange={(e) => setContentForm(f => ({ ...f, ownerRole: e.target.value }))} />
          </div>
          <div className="form-actions">
            <button type="button" className="srip-button" onClick={() => setContentFormOpen(false)}>{t('انصراف')}</button>
            <button type="submit" className="srip-button primary" disabled={busy}>{busy ? t('در حال ذخیره…') : t('ثبت پیش‌نویس خروجی')}</button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
