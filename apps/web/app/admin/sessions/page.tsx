'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, apiPost } from '../../_lib/api';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../../_components/page-ui';
import {
  ClipboardList, Fingerprint, KeyRound, Lock, RefreshCw, ScrollText, ShieldCheck, Trash2, UserRound, XCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  حاکمیت نشست‌ها — ابطال مدیریتی (session.admin.revoke) + ممیزی       */
/* ------------------------------------------------------------------ */

type AuditRow = { id: string; action?: string; entity?: string | null; entityId?: string | null; actorEmail?: string | null; at?: string; meta?: any };
type AdminUser = { id: string; email: string; name: string; isActive: boolean; lastLoginAt?: string | null };

const fmtDT = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fa-IR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

export default function AdminSessions() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [userId, setUserId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true); setError(''); setNotice('');
    try {
      const [us, au] = await Promise.all([
        api<any>('/admin/users').then(x => (Array.isArray(x) ? x : x?.items ?? x?.users ?? []) as AdminUser[]).catch(() => [] as AdminUser[]),
        api<any>('/admin/audit').then(x => (Array.isArray(x) ? x : x?.events ?? x?.items ?? x?.rows ?? []) as AuditRow[]).catch(() => [] as AuditRow[]),
      ]);
      setUsers(us);
      const sessionEvents = (au as AuditRow[]).filter(e => e.entity === 'Session' && (e.action === 'LOGOUT' || (e.meta && (e.meta.reason ?? e.meta.meta?.reason) === 'admin-session-revoked'))).slice(0, 12);
      setAudit(sessionEvents);
    } catch (x) { setError((x as Error).message); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice(''); setResult(null);
    const uid = userId.trim(), sid = sessionId.trim();
    if (!uid || !sid) { setError('شناسهٔ کاربر و شناسهٔ نشست هر دو لازم هستند.'); return; }
    setBusy('revoke');
    try {
      const out = await apiPost<{ count?: number; revokedAt?: string }>(`/sessions/admin/${encodeURIComponent(uid)}/${encodeURIComponent(sid)}/revoke`, {});
      setResult({ ok: (out.count ?? 0) > 0, text: (out.count ?? 0) > 0 ? `نشست ${sid} با موفقیت ابطال شد${out.revokedAt ? ` (${fmtDT(out.revokedAt)})` : ''}.` : 'این نشست از قبل ابطال‌شده بود.' });
      if ((out.count ?? 0) > 0) { setSessionId(''); await load(true); }
    } catch (x) {
      setResult({ ok: false, text: (x as Error).message });
    } finally { setBusy(''); }
  }
  function fill(uid: string, sid?: string) {
    setResult(null); setError('');
    setUserId(uid); if (sid) setSessionId(sid);
    setNotice(uid ? 'شناسهٔ کاربر در فرم ابطال قرار گرفت.' : '');
    setTimeout(() => setNotice(''), 3500);
  }
  function reasonOf(m: any): string {
    if (!m) return '';
    const r = m.reason ?? m.meta?.reason ?? '';
    return r === 'admin-session-revoked' ? 'ابطال مدیریتی نشست' : r || '';
  }
  const busyOn = (k: string) => busy === k;
  const targetName = users.find(u => u.id === userId)?.name ?? users.find(u => u.id === userId)?.email ?? '';

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / امنیت"
        title="حاکمیت نشست‌ها"
        description="ابطال مدیریتی نشست هر کاربر و رصد ابطال‌های انجام‌شده — نیازمند مجوز session.admin.revoke؛ نشست‌های سایر کاربران بدون ابطال مدیریتی قابل حذف نیستند."
        actions={
          <button className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> بازخوانی
          </button>
        }
      />
      <ErrorCard message={error} />
      {notice && <div className="notice" role="status">{notice}</div>}
      {result && (
        <div className="notice" role="status" style={result.ok ? { borderColor: 'var(--green,#16a34a)', color: 'var(--green,#16a34a)' } : { borderColor: 'var(--red,#dc2626)', color: 'var(--red,#dc2626)' }}>
          {result.ok ? <ShieldCheck size={13} style={{ verticalAlign: -2 }} /> : <XCircle size={13} style={{ verticalAlign: -2 }} />} {result.text}
        </div>
      )}

      {loading && users.length === 0 ? <Loading label="در حال بارگذاری حاکمیت نشست‌ها…" /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={<KeyRound size={18} />} label="کاربران سامانه" value={new Intl.NumberFormat('fa-IR').format(users.length)} iconClass="ic-blue" sub="برای انتخاب در فرم ابطال" />
            <StatCard icon={<ScrollText size={18} />} label="ابطال‌های مدیریتی اخیر" value={new Intl.NumberFormat('fa-IR').format(audit.length)} iconClass="ic-gold" sub="از ممیزی سرور" />
            <StatCard icon={<Lock size={18} />} label="مجوز لازم" value="session.admin.revoke" iconClass="ic-purple" sub="فقط مدیران دارای مجوز" />
            <StatCard icon={<Fingerprint size={18} />} label="محدودیت" value="شناسهٔ نشست" iconClass="ic-red" sub="بدون ابزار مرور فهرست (حریم خصوصی)" />
          </div>

          <div className="grid2" style={{ alignItems: 'stretch' }}>
            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><KeyRound size={16} /> ابطال مدیریتی نشست</h2>
                  <p>شناسهٔ کاربر و شناسهٔ نشست را وارد کنید؛ پس از ابطال، دستگاهِ هدف بلافاصله از دسترسی می‌افتد و رویداد در ممیزی با «admin-session-revoked» ثبت می‌شود.</p>
                </div>
              </div>
              <form className="entity-form" onSubmit={revoke} style={{ gap: 10 }}>
                <div className="field full">
                  <label className="field-label" htmlFor="adm-uid">شناسهٔ کاربر (userId) <span className="req">*</span></label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input id="adm-uid" dir="ltr" list="admin-user-list" value={userId} onChange={e => setUserId(e.target.value)} required placeholder="u-… یا شناسهٔ کاربر" style={{ textAlign: 'left', fontFamily: 'ui-monospace,monospace', fontSize: 11, flex: 1 }} />
                    <datalist id="admin-user-list">
                      {users.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
                    </datalist>
                    <select value={userId} onChange={e => setUserId(e.target.value)} style={{ maxWidth: 200 }} aria-label="انتخاب کاربر">
                      <option value="">انتخاب کاربر…</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                    </select>
                  </div>
                  {targetName && <small className="t-muted" style={{ display: 'block', marginTop: 3 }}>کاربر هدف: <b>{targetName}</b></small>}
                </div>
                <div className="field full">
                  <label className="field-label" htmlFor="adm-sid">شناسهٔ نشست (sessionId) <span className="req">*</span></label>
                  <input id="adm-sid" dir="ltr" value={sessionId} onChange={e => setSessionId(e.target.value)} required placeholder="s-… یا شناسهٔ نشست" style={{ textAlign: 'left', fontFamily: 'ui-monospace,monospace', fontSize: 11 }} />
                </div>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '9px 18px', minHeight: 0 }} disabled={busyOn('revoke')}>
                  {busyOn('revoke') ? 'در حال ابطال…' : <><Trash2 size={14} /> ابطال نشست</>}
                </button>
              </form>
              <p className="t-muted" style={{ margin: '12px 0 0', fontSize: 10.5 }}>
                <Lock size={11} style={{ verticalAlign: -2 }} /> برای حفظ حریم خصوصی، فهرست نشست‌های سایر کاربران در دسترس مدیر نیست؛ شناسهٔ نشست از خودِ کاربر (صفحهٔ «نشست‌های من») یا رویدادهای ممیزی گرفته می‌شود.
              </p>
            </section>

            <section className="panel" style={{ margin: 0 }}>
              <div className="panel-title">
                <div>
                  <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ScrollText size={16} /> ابطال‌های مدیریتی اخیر</h2>
                  <p>رویدادهای LOGOUT ثبت‌شده بر نهاد Session با دلیل admin-session-revoked (از ممیزی سرور).</p>
                </div>
                <Badge tone="info">{new Intl.NumberFormat('fa-IR').format(audit.length)} رویداد</Badge>
              </div>
              {audit.length === 0 ? (
                <div className="empty-state">ابطال مدیریتی‌ای ثبت نشده است.</div>
              ) : (
                <div className="list">
                  {audit.map(a => {
                    const m = a.meta ?? {};
                    const targetUid = m.userId ?? m.meta?.userId ?? '';
                    const sid = a.entityId ?? m.sessionId ?? m.meta?.sessionId ?? '';
                    const actor = a.actorEmail ?? '—';
                    return (
                      <article className="listRow" key={a.id} style={{ alignItems: 'center' }}>
                        <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flex: '0 0 auto', background: 'color-mix(in srgb, var(--red,#dc2626) 12%, transparent)', color: 'var(--red,#dc2626)' }}>
                          <ShieldCheck size={14} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <b style={{ fontSize: 11.5 }}>{reasonOf(m) || 'ابطال نشست'}</b>
                            <Badge tone="neutral">کاربر: <code dir="ltr" style={{ fontSize: 9.5 }}>{targetUid}</code></Badge>
                            <Badge tone="neutral">نشست: <code dir="ltr" style={{ fontSize: 9.5 }}>{String(sid).slice(0, 14)}</code></Badge>
                          </span>
                          <span className="t-muted" style={{ display: 'block', fontSize: 10, marginTop: 2 }}>
                            <UserRound size={10} style={{ verticalAlign: -1 }} /> {actor} · {fmtDT(a.at)}
                          </span>
                        </span>
                        <button className="secondary-action" style={{ padding: '6px 10px', minHeight: 0 }} onClick={() => fill(targetUid, sid)}>
                          <ClipboardList size={12} /> استفاده در فرم
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
