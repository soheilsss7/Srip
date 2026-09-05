'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { ErrorCard, Loading } from '../_components/page-ui';
import {
  JALALI_MONTHS, WEEKDAYS_SAT, faNum, todayJalali, toJalali, toGregorian,
  jalaaliMonthLength, saturdayFirst, toJalaliKey,
} from '../_lib/jalali';
import { CalendarDays, ChevronRight, ChevronLeft, Plus, Clock, MapPin, RefreshCw, Building2 } from 'lucide-react';

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

export default function CalendarPage() {
  const now = todayJalali();
  const { scopeId } = useWorkspace();
  const [jy, setJy] = useState(now.jy);
  const [jm, setJm] = useState(now.jm);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [scopeName, setScopeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const qs = scopeId !== 'all' ? `?organizationId=${encodeURIComponent(scopeId)}` : '';
      setMeetings(unwrap(await api(`/meetings${qs}`)));
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

  // Grid: Saturday-first, 6 rows × 7 cols
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
  const upcoming = useMemo(() =>
    [...meetings]
      .filter(m => new Date(m.startAt).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 7),
    [meetings],
  );

  const timeOf = (iso: string) => {
    const d = new Date(iso);
    return faNum(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  };

  return (
    <main className="feature-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">فضای کاری SRIP · تقویم جلسات</div>
          <h1>تقویم جلسات</h1>
          <p className="subtitle">نمای ماهانهٔ جلالی — هر روز جلسات، سازمان مرتبط و وضعیت نتیجه را نشان می‌دهد. کلیک روی هر جلسه، پروفایل کامل آن را باز می‌کند.</p>
        </div>
        <div className="heading-tools">
          <Link className="primary-action" href="/meetings"><Plus size={14}/> جلسهٔ جدید</Link>
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
                {scopeId !== 'all' && <span className="chip info">محدوده: {scopeName || scopeId.slice(0, 8)}</span>}
              </div>
              <div className="cal-nav">
                <button className="btn btn-ghost btn-sm" onClick={() => nav(1)} aria-label="ماه بعد"><ChevronRight size={16}/></button>
                <button className="btn btn-ghost btn-sm" onClick={goToday}>امروز</button>
                <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} aria-label="ماه قبل"><ChevronLeft size={16}/></button>
              </div>
            </div>

            <div className="cal-grid" role="grid" aria-label={`تقویم ${JALALI_MONTHS[jm - 1]} ${faNum(jy)}`}>
              {WEEKDAYS_SAT.map(w => <div className="cal-dow" key={w}>{w}</div>)}
              {grid.map((cell, i) => {
                if (!cell) return <div className="cal-cell blank" key={i} />;
                const list = byKey.get(cell.key) ?? [];
                const isToday = cell.key === todayKey;
                const hasOutcome = list.some(m => m.outcome);
                return (
                  <div className={`cal-cell${isToday ? ' today' : ''}${list.length ? ' has-events' : ''}`} key={i} role="gridcell">
                    <span className={`cal-day${isToday ? ' today' : ''}`}>{faNum(cell.jd)}</span>
                    <div className="cal-events">
                      {list.slice(0, 3).map(m => (
                        <Link className="cal-event" href={`/meetings/${m.id}`} key={m.id} title={`${m.title} — ${timeOf(m.startAt)}`}>
                          <span className="cal-event-dot" style={{ background: m.outcome ? 'var(--srip-success)' : m.organization?.name ? 'var(--srip-accent)' : 'var(--text-muted)' }} />
                          <span className="cal-event-time">{timeOf(m.startAt)}</span>
                          <span className="cal-event-title">{m.title}</span>
                        </Link>
                      ))}
                      {list.length > 3 && <span className="cal-more">+{faNum(list.length - 3)} جلسهٔ دیگر</span>}
                    </div>
                    {hasOutcome && <span className="cal-outcome-chip">نتیجه ثبت شده</span>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Side panel */}
          <aside className="cal-side">
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

            <section className="panel">
              <div className="panel-title"><div><h2>امروز</h2><p>{JALALI_MONTHS[now.jm - 1]} {faNum(now.jd)}</p></div></div>
              {(byKey.get(todayKey) ?? []).length === 0 ? (
                <p className="empty-state"><CalendarDays size={18}/> جلسه‌ای برای امروز نیست.</p>
              ) : (
                <div className="list">
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
    </main>
  );
}
