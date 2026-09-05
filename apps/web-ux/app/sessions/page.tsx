'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiDelete, apiPost } from '../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import {
  Clock3, Globe, Laptop, Monitor, RefreshCw, RotateCcw, ShieldX, Smartphone, Tablet, Timer, Trash2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  نشست‌های من — پاریتی SessionsController (list/revoke)              */
/* ------------------------------------------------------------------ */

type Session = {
  id: string; deviceName?: string | null; ipAddress?: string | null; userAgent?: string | null;
  createdAt?: string; lastActivityAt?: string | null; idleExpiresAt?: string; absoluteExpiresAt?: string;
  expiresAt?: string; revokedAt?: string | null; rotatedAt?: string | null; isCurrent?: boolean;
  userName?: string | null; userEmail?: string | null;
};

const fmtDT = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }) + (withTime ? `، ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : '');
};
const daysLeft = (iso?: string | null) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86400000);
};
const statusOf = (s: Session): 'active' | 'revoked' | 'rotated' | 'expired' => {
  if (s.revokedAt && s.rotatedAt) return 'rotated';
  if (s.revokedAt) return 'revoked';
  const left = daysLeft(s.absoluteExpiresAt ?? s.expiresAt);
  if (left != null && left <= 0) return 'expired';
  return 'active';
};
function deviceInfo(s: Session): { label: string; icon: React.ReactNode; color: string } {
  const ua = (s.userAgent ?? '') + ' ' + (s.deviceName ?? '');
  const isApp = /SRIP-App|App\//i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = isTablet || /Android|iPhone|Mobile/i.test(ua) && !/Windows|Macintosh/i.test(ua);
  const os = /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iOS/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : isApp ? 'اپلیکیشن' : '';
  const label = [browser || (isApp ? 'اپلیکیشن SRIP' : 'مرورگر'), os].filter(Boolean).join(' — ') || 'دستگاه';
  const icon = isApp ? <Smartphone size={15} /> : isTablet ? <Tablet size={15} /> : /Android|iPhone|Mobile/i.test(ua) && !/Windows|Macintosh/i.test(ua) ? <Smartphone size={15} /> : <Monitor size={15} />;
  return { label, icon, color: '#2563eb' };
}

export default function SessionsPage() {
  const [rows, setRows] = useState<Session[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setNotice('');
    try {
      const list = await api<Session[]>('/sessions');
      setRows(Array.isArray(list) ? list : (list as any)?.sessions ?? []);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const active = rows.filter(r => statusOf(r) === 'active');
  const current = rows.find(r => r.isCurrent) ?? null;
  const currentActive = current ? statusOf(current) === 'active' : false;

  async function revokeOne(s: Session) {
    if (s.isCurrent) {
      if (!window.confirm('این نشستِ فعلی (مرورگری که اکنون در آن هستید) است. پس از ابطال، توکن تازه‌سازی آن می‌میرد و پس از پایان نشست باید دوباره وارد شوید. ادامه می‌دهید؟')) return;
    } else {
      if (!window.confirm(`نشست «${s.deviceName ?? s.id.slice(0, 8)}» ابطال می‌شود. ادامه می‌دهید؟`)) return;
    }
    setBusy('rev-' + s.id); setError(''); setNotice('');
    try {
      const out = await apiDelete<{ count?: number }>(`/sessions/${s.id}`);
      setNotice(out?.count ? 'نشست ابطال شد؛ دستگاه از فهرست نشست‌های فعال حذف شد.' : 'این نشست از قبل غیرفعال بود.');
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function revokeAllExcept() {
    if (!window.confirm('همهٔ نشست‌ها به‌جز نشستِ فعلی این مرورگر ابطال می‌شوند. ادامه می‌دهید؟')) return;
    setBusy('all-except'); setError(''); setNotice('');
    try {
      const out = await apiPost<{ count?: number }>('/sessions/revoke-all-except-current', {});
      setNotice(`${out?.count ?? 0} نشست دیگر ابطال شد؛ نشست فعلی حفظ شد.`);
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }
  async function revokeAll() {
    if (!window.confirm('همهٔ نشست‌ها — از جمله نشست فعلی — ابطال می‌شوند و باید دوباره وارد شوید. ادامه می‌دهید؟')) return;
    setBusy('all'); setError(''); setNotice('');
    try {
      const out = await apiPost<{ count?: number }>('/sessions/revoke-all', {});
      setNotice(`${out?.count ?? 0} نشست ابطال شد.`);
      await load(true);
    } catch (x) { setError((x as Error).message); } finally { setBusy(''); }
  }

  const busyOn = (k: string) => busy === k;
  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="هویت و امنیت حساب"
        title="نشست‌های من"
        description="دستگاه‌ها و مرورگرهایی که با حساب شما وارد شده‌اند؛ هر نشست معادل یک توکن تازه‌سازی با انقضای مطلق ۳۰ روز و انقضای بی‌کاری ۸ ساعت است."
        actions={
          <div className="toolbar" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={revokeAllExcept} disabled={busyOn('all-except') || active.length <= 1}>
              {busyOn('all-except') ? '…' : <><ShieldX size={14} /> ابطال بقیهٔ نشست‌ها</>}
            </button>
            <button className="btn btn-secondary" style={{ color: 'var(--red,#dc2626)', borderColor: 'color-mix(in srgb, var(--red,#dc2626) 40%, transparent)' }} onClick={revokeAll} disabled={busyOn('all') || rows.length === 0}>
              {busyOn('all') ? '…' : <><Trash2 size={14} /> ابطال همه</>}
            </button>
            <button className="btn btn-ghost" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
            </button>
          </div>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}

      {loading && rows.length === 0 ? <Loading label="در حال بارگذاری نشست‌ها…" /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Laptop size={18} />} label="نشست‌های فعال" value={new Intl.NumberFormat('fa-IR').format(active.length)} iconClass="ic-blue" sub="دستگاه‌های دارای دسترسی" />
            <StatCard icon={<Smartphone size={18} />} label="نشست فعلی" value={currentActive ? 'این دستگاه' : '—'} iconClass="ic-green" sub={current?.deviceName ? `آخرین فعالیت: ${fmtDT(current.lastActivityAt)}` : undefined} />
            <StatCard icon={<Clock3 size={18} />} label="آخرین فعالیت" value={active.length ? fmtDT([...active].sort((a, b) => String(b.lastActivityAt ?? '').localeCompare(String(a.lastActivityAt ?? '')))[0]?.lastActivityAt, false) : '—'} iconClass="ic-gold" sub="جدیدترین نشست فعال" />
            <StatCard icon={<Timer size={18} />} label="کل نشست‌های ثبت‌شده" value={new Intl.NumberFormat('fa-IR').format(rows.length)} iconClass="ic-purple" sub="شامل ابطال/چرخش‌شده" />
          </div>

          <section className="panel">
            <div className="panel-title">
              <div>
                <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Globe size={16} /> دستگاه‌ها و نشست‌ها</h2>
                <p>هر ردیف یک نشست مستقل است؛ ابطال، دسترسی آن دستگاه را بلافاصله قطع می‌کند.</p>
              </div>
              <Badge tone="info">{new Intl.NumberFormat('fa-IR').format(rows.length)} نشست</Badge>
            </div>
            {rows.length === 0 ? (
              <div className="empty-state">نشستی برای حساب شما ثبت نشده است.</div>
            ) : (
              <div className="list">
                {rows.map(s => {
                  const st = statusOf(s);
                  const dev = deviceInfo(s);
                  const left = daysLeft(s.absoluteExpiresAt ?? s.expiresAt);
                  const lastActive = s.lastActivityAt ?? s.createdAt;
                  return (
                    <article className="listRow" key={s.id} style={{ alignItems: 'flex-start', opacity: st === 'active' ? 1 : .6 }}>
                      <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: st === 'active' ? `color-mix(in srgb, ${dev.color} 12%, transparent)` : 'color-mix(in srgb, #64748b 12%, transparent)', color: st === 'active' ? dev.color : '#64748b' }}>
                        {dev.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b>{s.deviceName ?? dev.label}</b>
                          {s.isCurrent && <Badge tone="success">نشست فعلی</Badge>}
                          <Badge tone={st === 'active' ? 'success' : st === 'revoked' ? 'danger' : st === 'rotated' ? 'warning' : 'neutral'}>
                            {st === 'active' ? 'فعال' : st === 'revoked' ? 'ابطال‌شده' : st === 'rotated' ? 'چرخش‌خورده' : 'منقضی'}
                          </Badge>
                          {st === 'active' && left != null && (
                            <Badge tone={left <= 3 ? 'warning' : 'neutral'}><Timer size={10} /> {new Intl.NumberFormat('fa-IR').format(left)} روز تا انقضای مطلق</Badge>
                          )}
                        </span>
                        <span className="t-muted" style={{ display: 'block', fontSize: 10.5, marginTop: 2 }}>
                          <code dir="ltr" style={{ fontSize: 9.5 }}>{s.ipAddress ?? '—'}</code>
                          {' · '}آخرین فعالیت: {fmtDT(lastActive)}
                        </span>
                        {s.userAgent && (
                          <span className="t-muted" dir="ltr" style={{ display: 'block', fontSize: 9.5, textAlign: 'left', marginTop: 1, wordBreak: 'break-all', opacity: .75 }}>{s.userAgent}</span>
                        )}
                        <span className="t-muted" style={{ display: 'block', fontSize: 9.5, marginTop: 2 }}>
                          ساخته‌شده: {fmtDT(s.createdAt)} · انقضای مطلق: {fmtDT(s.absoluteExpiresAt ?? s.expiresAt)}
                          {s.revokedAt ? ` · ابطال: ${fmtDT(s.revokedAt)}` : ''}
                          {s.rotatedAt ? ` · چرخش: ${fmtDT(s.rotatedAt)}` : ''}
                        </span>
                      </span>
                      {st === 'active' && (
                        <button className="danger-action" style={{ padding: '7px 12px', minHeight: 0 }} onClick={() => revokeOne(s)} disabled={busyOn('rev-' + s.id)}>
                          {busyOn('rev-' + s.id) ? '…' : <><Trash2 size={13} /> ابطال</>}
                        </button>
                      )}
                      {st !== 'active' && (
                        <button className="secondary-action" style={{ padding: '7px 12px', minHeight: 0 }} onClick={() => revokeOne(s)} disabled={busyOn('rev-' + s.id)}>
                          {busyOn('rev-' + s.id) ? '…' : <><RotateCcw size={13} /> پاک‌کردن از فهرست</>}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <p className="t-muted" style={{ margin: '10px 0 0', fontSize: 10.5 }}>
              <RotateCcw size={11} style={{ verticalAlign: -2 }} /> توکن‌های تازه‌سازی در هر بار بازخوانی (rotation) چرخانده می‌شوند و نشست قبلیِ خانواده به‌صورت خودکار ابطال می‌گردد.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
