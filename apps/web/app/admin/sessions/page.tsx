'use client';

import { useEffect, useState } from 'react';
import { api, apiPost, unwrapList } from '../../_lib/api';
import { Badge, Empty, ErrorCard, Loading, PageHeader } from '../../_components/page-ui';
import { EntityPicker } from '../../_components/entity-picker';
import { useWorkspace } from '../../_components/workspace';

type Session = {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string;
  lastActivityAt?: string | null;
  expiresAt?: string;
  revokedAt?: string | null;
  rotatedAt?: string | null;
};

const sessionLabel = (session: Session) => [session.deviceName || 'دستگاه ناشناس', session.ipAddress || 'IP ثبت نشده', session.lastActivityAt ? new Date(session.lastActivityAt).toLocaleString('fa-IR') : 'بدون فعالیت اخیر'].join(' · ');

export default function AdminSessions() {
  const { can } = useWorkspace();
  const allowed = can('session.admin.revoke');
  const [userId, setUserId] = useState('');
  const [userLabel, setUserLabel] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function loadSessions(nextUserId: string) {
    if (!nextUserId || !allowed) { setSessions([]); setSessionId(''); return; }
    setLoading(true); setError(''); setOk(''); setSessionId('');
    try { setSessions(unwrapList<Session>(await api(`/sessions/admin/${encodeURIComponent(nextUserId)}`))); }
    catch (value) { setSessions([]); setError((value as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!allowed) { setUserId(''); setSessions([]); }
  }, [allowed]);

  async function revoke(event: React.FormEvent) {
    event.preventDefault();
    if (!allowed || !userId || !sessionId) { setError('کاربر و نشست را از فهرست انتخاب کنید.'); return; }
    setBusy(true); setError(''); setOk('');
    try {
      await apiPost(`/sessions/admin/${encodeURIComponent(userId)}/${encodeURIComponent(sessionId)}/revoke`, {});
      setOk(`نشست انتخاب‌شده برای «${userLabel || 'کاربر'}» با موفقیت Revoke شد.`);
      await loadSessions(userId);
    } catch (value) { setError((value as Error).message); }
    finally { setBusy(false); }
  }

  if (!allowed) return <main className="feature-page"><PageHeader eyebrow="ADMIN / SESSIONS" title="Session Governance" description="مدیریت نشست‌ها با کنترل دسترسی و Audit." /><section className="panel"><Empty>مجوز مدیریت نشست‌های دیگر کاربران برای شما فعال نیست.</Empty></section></main>;

  return <main className="feature-page">
    <PageHeader eyebrow="ADMIN / SESSIONS" title="Session Governance" description="کاربر و نشست را با نام دستگاه و زمان فعالیت انتخاب کنید؛ شناسه فنی نشست در عملیات عادی از شما درخواست نمی‌شود." />
    <ErrorCard message={error} />
    {ok && <div className="notice" role="status">{ok}</div>}
    <section className="panel">
      <div className="panel-title"><div><h2>Revoke مدیریتی نشست</h2><p>پس از انتخاب کاربر، فقط نشست‌های همان کاربر در فهرست قابل انتخاب نمایش داده می‌شوند.</p></div><Badge tone="warning">Sensitive operation</Badge></div>
      <form className="entity-form" onSubmit={revoke}>
        <EntityPicker label="کاربر" endpoint="/users/picker" value={userId} onChange={(nextId) => { setUserId(nextId); void loadSessions(nextId); }} onLabelChange={(_, label) => setUserLabel(label)} required disabled={busy} />
        <label>نشست فعال یا تاریخی<select value={sessionId} onChange={event => setSessionId(event.target.value)} disabled={!userId || loading || busy} required><option value="">{loading ? 'در حال بارگذاری نشست‌ها…' : sessions.length ? 'انتخاب نشست…' : 'نشستی برای این کاربر پیدا نشد'}</option>{sessions.map(session => <option key={session.id} value={session.id}>{sessionLabel(session)}{session.revokedAt ? ' · revoked' : session.rotatedAt ? ' · rotated' : ''}</option>)}</select></label>
        {userId && !loading && sessions.length === 0 && <p className="empty-state">برای این کاربر نشستی جهت Revoke وجود ندارد.</p>}
        <button className="primary-action danger" type="submit" disabled={busy || loading || !userId || !sessionId}>{busy ? 'در حال Revoke…' : 'Revoke نشست انتخاب‌شده'}</button>
      </form>
    </section>
  </main>;
}
