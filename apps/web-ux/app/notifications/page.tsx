'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiGet, unwrapList } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import { Bell, BellOff, BellRing, CalendarClock, CheckCheck, CheckCircle2, HardDriveDownload, Inbox, Mail, RefreshCw, Send, Smartphone, Trash2, Wifi, WifiOff, Zap } from 'lucide-react';
import { localeTag, lt, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   مرکز اعلان‌ها — یکپارچه (نوبت ۲۰۲۶-۰۹-۲۰):
   · اعلان‌های درون‌برنامه‌ای با فیلتر همه/خوانده‌نشده/مهم + علامت‌گذاری خوانده
   · اعلان‌های این دستگاه: رضایت مرورگر، اشتراک/لغو، اعلان آزمایشی، دریافت خودکار
   · ترجیحات اعلان (ماندگار در سرور) + خلاصهٔ روزانه/هفتگی
   · گزارش تحویل (رکورد واقعی ارسال‌ها)
   · دسترسی بدون اینترنت: صفحات بازدیدشده در حافظهٔ محلی
   ═══════════════════════════════════════════════════════════════════════════ */

type Sub = { id: string; endpointMasked: string; topics: string[]; consent: string; active: boolean; createdAt: string; revokedAt: string | null };
type Delivery = { id: string; channel: string; provider: string; title: string; count: number | null; accepted: boolean; createdAt: string };

const PREF_FIELDS = ['inAppEnabled', 'emailEnabled', 'pushEnabled', 'digestEnabled', 'criticalOnly', 'dailyDigest', 'weeklyDigest'] as const;
const PREF_LABELS: Record<string, { label: string; desc: string }> = lt({
  inAppEnabled: { label: t('اعلان درون‌برنامه‌ای'), desc: t('نمایش در مرکز اعلان') },
  emailEnabled: { label: t('ایمیل'), desc: t('ارسال به ایمیل سازمانی') },
  pushEnabled: { label: t('اعلان دستگاه'), desc: t('اعلان لحظه‌ای این مرورگر') },
  digestEnabled: { label: t('خلاصهٔ دوره‌ای'), desc: t('خلاصهٔ اعلان‌های خوانده‌نشده') },
  criticalOnly: { label: t('فقط موارد مهم'), desc: t('ارسال فقط برای اولویت مهم و بحرانی') },
  dailyDigest: { label: t('خلاصهٔ روزانه'), desc: t('یک نگاه هر صبح') },
  weeklyDigest: { label: t('خلاصهٔ هفتگی'), desc: t('جمع‌بندی پایان هفته') },
});
const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral' | 'success'> = { critical: 'danger', important: 'warning', recommendation: 'info', reminder: 'info', information: 'neutral', success: 'success' };
const TYPE_FA: Record<string, string> = lt({ REMINDER: t('یادآوری'), RECOMMENDATION: t('پیشنهاد'), SYSTEM: t('سیستمی'), ALERT: t('هشدار') });
const PRIORITY_FA: Record<string, string> = lt({ LOW: t('کم'), MEDIUM: t('متوسط'), HIGH: t('زیاد'), CRITICAL: t('بحرانی'), IMPORTANT: t('مهم'), RECOMMENDATION: t('پیشنهاد'), INFORMATION: t('اطلاع') });
const CHANNEL_FA: Record<string, string> = lt({ IN_APP: t('درون‌برنامه‌ای'), EMAIL: t('ایمیل'), PUSH: t('اعلان دستگاه'), SMS: t('پیامک'), WEBHOOK: t('وبهوک') });
const TYPE_ICON: Record<string, React.ReactNode> = { REMINDER: <BellRing size={15} />, RECOMMENDATION: <Zap size={15} />, SYSTEM: <CheckCircle2 size={15} />, ALERT: <BellRing size={15} /> };

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));
const fmtTime = (iso: string) => new Date(iso).toLocaleString(localeTag(), { dateStyle: 'medium', timeStyle: 'short' });

export default function NotificationsPage() {
  const { isRealTenant } = useWorkspace();
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<Delivery[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [permission, setPermission] = useState<string>('default');
  const [online, setOnline] = useState(true);
  const [swReady, setSwReady] = useState(false);
  const [cachedPages, setCachedPages] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const permRef = useRef<string>('default');
  permRef.current = permission;

  const loadSubs = useCallback(async () => {
    try { setSubs((await apiGet<{ items: Sub[] }>('/notifications/push/subscriptions')).items ?? []); }
    catch { /* اشتراکی نیست */ }
  }, []);

  const loadCaches = useCallback(async () => {
    try {
      if (typeof caches === 'undefined') { setCachedPages(null); return; }
      let total = 0;
      for (const n of await caches.keys()) total += (await (await caches.open(n)).keys()).length;
      setCachedPages(total);
    } catch { setCachedPages(null); }
  }, []);

  const load = useCallback(async () => {
    try {
      const [n, u, pref, l] = await Promise.all([
        api('/notifications').then(unwrapList),
        api('/notifications/unread-count'),
        api<Record<string, boolean>>('/notifications/preferences'),
        api('/notifications/delivery-log').then(unwrapList<Delivery>),
      ]);
      setItems(n);
      setUnread(typeof u === 'number' ? u : (u as any)?.count ?? 0);
      setPrefs(pref && typeof pref === 'object' ? pref : {});
      setLog(l);
    } catch (e) { setError((e as Error).message); }
  }, []);

  /* دریافت خودکار: صف اعلان این دستگاه هر ۱۰ ثانیه بررسی می‌شود؛ پیام تازه
     با اعلان مرورگر (در صورت رضایت) نمایش و رسید تحویل ثبت می‌شود. */
  const receive = useCallback(async () => {
    try {
      const pend = await apiGet<{ items: { id: string; title: string; body: string; topic: string }[] }>('/notifications/push/pending');
      let fresh = 0;
      for (const p of pend.items ?? []) {
        fresh++;
        try {
          if (permRef.current === 'granted' && 'serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.showNotification?.(p.title, { body: p.body, dir: 'rtl', lang: 'fa', tag: p.id });
          }
        } catch { /* اعلان سیستم در محیط بدون تعامل نمایش نمی‌شود */ }
        await api(`/notifications/push/pending/${p.id}/ack`, { method: 'POST', body: '{}' });
      }
      setLastCheck(new Date());
      if (fresh > 0) await load();
    } catch { /* قطع موقت — بررسی بعدی */ }
  }, [load]);

  useEffect(() => {
    setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          setSwReady(!!reg?.active);
        }
      } catch { /* سرویس‌ورکر در دسترس نیست */ }
      await Promise.all([load(), loadSubs(), loadCaches()]);
      setLoading(false);
    })();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load, loadSubs, loadCaches]);

  useEffect(() => {
    void receive();
    const id = setInterval(() => { if (navigator.onLine) void receive(); }, 10000);
    return () => clearInterval(id);
  }, [receive]);

  async function markRead(id: string) {
    setBusy('read' + id);
    try { await api(`/notifications/${id}/read`, { method: 'PATCH' }); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function markAllRead() {
    setBusy('readall');
    try { await api('/notifications/read-all', { method: 'PATCH' }); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function savePrefs() {
    setBusy('prefs'); setError(''); setStatus('');
    try {
      await api('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(prefs) });
      setStatus(t('ترجیحات اعلان ذخیره شد.'));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  async function digest(cadence: 'DAILY' | 'WEEKLY') {
    setBusy(cadence); setError(''); setStatus('');
    try {
      const r: any = await api(`/notifications/digest/${cadence}`, { method: 'POST', body: '{}' });
      setStatus(r?.sent
        ? `${cadence === 'DAILY' ? t('خلاصهٔ روزانه برای') : t('خلاصهٔ هفتگی برای')} ${fmtN(r.count)} ${t('اعلان خوانده‌نشده ارسال شد.')}`
        : r?.reason === 'digest-disabled' ? t('خلاصهٔ دوره‌ای یا ایمیل در ترجیحات فعال نیست.')
        : r?.reason === 'empty' ? t('اعلان خوانده‌نشده‌ای در بازهٔ خلاصه نیست.')
        : r?.reason === 'no-email' ? t('حساب شما ایمیل ندارد.')
        : t('خلاصهٔ دوره‌ای ارسال نشد.'));
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  }
  const togglePref = (k: string) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') { setError(t('این مرورگر از اعلان پشتیبانی نمی‌کند.')); return; }
    try { setPermission(await Notification.requestPermission()); }
    catch { setPermission('denied'); }
  };

  const subscribe = async () => {
    if (permission !== 'granted') { setError(t('ابتدا رضایت اعلان مرورگر را بدهید.')); return; }
    setBusy('subscribe'); setError(''); setFlash('');
    try {
      const endpoint = `https://push.srip.local/sub/${crypto.randomUUID?.() ?? String(Date.now())}`;
      const r = await api<{ id: string }>('/notifications/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint, consent: 'GRANTED', topics: ['PORTAL', 'MEDIA', 'GENERAL'], keys: { p256dh: 'browser', auth: 'browser' } }),
      });
      setFlash(`${t('این دستگاه مشترک اعلان شد (')}${r.id.slice(0, 10)}${t('…).')}`);
      await loadSubs();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const sendTest = async () => {
    setBusy('test'); setError(''); setFlash('');
    try {
      const r = await api<{ sent: number; message: string }>('/notifications/push/test', { method: 'POST', body: '{}' });
      setFlash(r.message);
      await Promise.all([load(), loadSubs()]);
      await receive();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const revoke = async (id: string) => {
    setBusy('revoke' + id); setError('');
    try { await api(`/notifications/push/subscriptions/${id}/revoke`, { method: 'POST', body: '{}' }); await loadSubs(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const clearOffline = async () => {
    setBusy('offline'); setError('');
    try {
      if (typeof caches !== 'undefined') {
        await Promise.all((await caches.keys()).map(n => caches.delete(n)));
        await loadCaches();
      }
      setFlash(t('حافظهٔ آفلاین پاک شد — صفحات با بازدید بعدی دوباره ذخیره می‌شوند.'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const refreshAll = async () => {
    setBusy('refresh');
    try { await Promise.all([load(), loadSubs(), loadCaches(), receive()]); }
    finally { setBusy(''); }
  };

  const activeSubs = subs.filter(s => s.active);
  const shown = items.filter(n => {
    if (filter === 'unread') return !(n.readAt ?? n.isRead === true);
    if (filter === 'important') return ['critical', 'important', 'high'].includes(String(n.priority).toLowerCase());
    return true;
  });
  const channels = new Set(items.map(n => n.channel).filter(Boolean)).size;

  return (
    <main className="feature-page">
      <PageHeader
        title={t('مرکز اعلان‌ها')}
        description={t('اعلان‌های سامانه، ترجیحات دریافت و اعلان‌های این دستگاه — همه در یک‌جا.')}
        actions={
          <>
            <button className="btn btn-secondary" onClick={refreshAll} disabled={!!busy}><RefreshCw size={15} /> {t('بازخوانی')}</button>
            <button className="btn btn-primary" onClick={markAllRead} disabled={!!busy || unread === 0}><CheckCheck size={15} /> {t('خواندن همه')}</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {status && <div className="notice" role="status">{status}</div>}
      {flash && <div className="flash" role="status">{flash}</div>}

      {loading ? <Loading /> : (<>
        <div className="stat-grid">
          <StatCard icon={<Bell size={18} />} label={t('خوانده‌نشده')} value={fmtN(unread)} iconClass="ic-red" sub={unread > 0 ? t('نیازمند توجه') : t('همه خوانده شد')} />
          <StatCard icon={<Inbox size={18} />} label={t('کل اعلان‌ها')} value={fmtN(items.length)} iconClass="ic-blue" sub={`${fmtN(channels)} ${t('کانال دریافت')}`} />
          <StatCard icon={<Smartphone size={18} />} label={t('اشتراک فعال این حساب')} value={fmtN(activeSubs.length)} iconClass="ic-teal" sub={permission === 'granted' ? t('اعلان مرورگر فعال است') : t('اعلان مرورگر فعال نیست')} />
          <StatCard icon={<Mail size={18} />} label={t('تحویل ثبت‌شده')} value={fmtN(log.length)} iconClass="ic-gold" sub={t('ارسال اعلان و خلاصهٔ دوره‌ای')} />
        </div>

        <SectionCard title={t('اعلان‌ها')} icon={<BellRing size={17} />} description={`${fmtN(unread)} ${t('مورد خوانده‌نشده')}`}
          actions={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {([['all', t('همه')], ['unread', t('خوانده‌نشده')], ['important', t('مهم')]] as const).map(([k, label]) => (
                <button key={k} className={`chip ${filter === k ? 'info' : 'neutral'}`} style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => setFilter(k)} aria-pressed={filter === k}>{label}</button>
              ))}
            </div>
          }>
          {shown.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Inbox size={24} /></div>
              <strong>{filter === 'unread' ? t('اعلان خوانده‌نشده نیست') : filter === 'important' ? t('اعلان مهمی نیست') : t('اعلانی وجود ندارد')}</strong>
              <p>{t('یادآوری‌ها، پیشنهادهای هوشمند و پیام‌های سیستمی اینجا نمایش داده می‌شوند.')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {shown.map(n => {
                const tone = PRIORITY_TONE[String(n.priority).toLowerCase()] ?? 'neutral';
                const readAt = n.readAt ?? n.isRead === true;
                return (
                  <div key={n.id} className={`ai-match-card ${!readAt ? 'unread-card' : ''}`} style={{ borderInlineStart: !readAt ? '3px solid var(--srip-accent)' : undefined, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span className={`stat-ico ${tone === 'danger' ? 'ic-red' : tone === 'warning' ? 'ic-gold' : tone === 'info' ? 'ic-purple' : 'ic-blue'}`} style={{ width: 36, height: 36, borderRadius: 10, flex: '0 0 auto' }}>
                      {TYPE_ICON[n.type] ?? <Bell size={16} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 13.5 }}>{n.title}</b>
                        {!readAt && <span className="chip danger">{t('جدید')}</span>}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.75, margin: '3px 0 0' }}>{n.body}</p>
                      <div className="match-meta" style={{ marginTop: 6 }}>
                        <span className="chip neutral">{TYPE_FA[n.type] ?? t('سیستمی')}</span>
                        <span className="chip neutral">{PRIORITY_FA[String(n.priority).toUpperCase()] ?? String(n.priority)}</span>
                        {n.channel && <span className="chip neutral">{CHANNEL_FA[String(n.channel).toUpperCase()] ?? n.channel}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarClock size={12} /> {fmtTime(n.createdAt)}</span>
                        {!readAt && <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => markRead(n.id)} disabled={!!busy}>{t('علامت‌گذاری خوانده')}</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
          <SectionCard title={t('اعلان‌های این دستگاه')} icon={<Smartphone size={17} />}
            description={t('رضایت اعلان ملزم است و هر زمان می‌توانید آن را لغو کنید.')}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone={permission === 'granted' ? 'success' : permission === 'denied' ? 'danger' : 'warning'}>
                {permission === 'granted' ? t('رضایت اعلان: داده‌شده') : permission === 'denied' ? t('رضایت اعلان: ردشده') : t('رضایت اعلان: خواسته‌نشده')}
              </Badge>
              <Badge tone={online ? 'success' : 'warning'}>{online ? t('برخط') : t('آفلاین')}</Badge>
              {swReady && <Badge tone="info">{t('سرویس‌ورکر فعال')}</Badge>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {permission !== 'granted' && <button className="btn btn-secondary" onClick={requestPermission}><Bell size={14} /> {t('فعال‌سازی اعلان مرورگر')}</button>}
              <button className="btn btn-primary" disabled={busy !== '' || permission !== 'granted'} onClick={subscribe}><BellRing size={14} /> {t('اشتراک این دستگاه')}</button>
              <button className="btn btn-secondary" disabled={busy !== '' || activeSubs.length === 0} onClick={sendTest}><Send size={14} /> {t('ارسال اعلان آزمایشی')}</button>
            </div>
            <p className="pp-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              {online
                ? `${t('دریافت خودکار فعال است (هر ۱۰ ثانیه)')}${lastCheck ? ` — ${t('آخرین بررسی:')} ${lastCheck.toLocaleTimeString(localeTag())}` : ''}`
                : t('اتصال قطع است — پس از برقراری اتصال، اعلان‌ها دریافت می‌شوند.')}
              {' '}
              {isRealTenant
                ? t('اعلان‌های این حساب هنگام باز بودن سامانه دریافت می‌شوند.')
                : t('در دمو، اعلان‌ها با بازبینی دوره‌ای صف سرور دریافت می‌شوند؛ در استقرار کامل با سرویس اعلان (Web Push) تحویل انجام می‌شود.')}
            </p>
            {subs.length > 0 && (
              <div className="p3-list" style={{ marginTop: 10 }}>
                {subs.map(s => (
                  <div key={s.id} className="p3-row">
                    <div style={{ minWidth: 0 }}>
                      <code style={{ fontSize: 11, direction: 'ltr', wordBreak: 'break-all' }}>{s.endpointMasked}</code>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.topics.map(tp => <span key={tp} className="p3-chip">{tp}</span>)}
                        {s.active ? <Badge tone="success">{t('فعال')}</Badge> : <Badge tone="danger">{t('لغوشده')}</Badge>}
                      </div>
                    </div>
                    {s.active && <button className="btn btn-secondary btn-sm" disabled={busy !== ''} onClick={() => revoke(s.id)}><BellOff size={13} /> {t('لغو رضایت')}</button>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
              <HardDriveDownload size={14} />
              <b style={{ fontSize: 12 }}>{t('دسترسی بدون اینترنت')}</b>
              <span className="chip neutral">{cachedPages === null ? '—' : `${fmtN(cachedPages)} ${t('صفحه ذخیره‌شده')}`}</span>
              <button className="btn btn-secondary btn-sm" disabled={busy !== ''} onClick={clearOffline}><Trash2 size={13} /> {t('پاک‌سازی')}</button>
            </div>
            <p className="pp-muted" style={{ fontSize: 11, marginTop: 6 }}>
              {isRealTenant
                ? t('صفحات بازدیدشده برای دسترسی بدون اینترنت ذخیره می‌شوند.')
                : t('صفحات بازدیدشده برای دسترسی بدون اینترنت ذخیره می‌شوند؛ دادهٔ API دمو نیز داخل سرویس‌ورکر اجرا می‌شود.')}
            </p>
          </SectionCard>

          <SectionCard title={t('ترجیحات اعلان')} icon={<Bell size={17} />} description={t('کانال‌ها و حالت‌های ارسال')}>
            <div style={{ display: 'grid', gap: 9 }}>
              {PREF_FIELDS.map(k => {
                const meta = PREF_LABELS[k];
                return (
                  <label key={k} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', background: 'var(--card-bg-soft)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!prefs[k]} onChange={() => togglePref(k)} style={{ width: 17, height: 17, accentColor: 'var(--srip-accent)' }} />
                    <span style={{ flex: 1 }}><b style={{ display: 'block', fontSize: 12.5, color: 'var(--text-primary)' }}>{meta.label}</b><small style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>{meta.desc}</small></span>
                  </label>
                );
              })}
            </div>
            <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn btn-primary btn-sm" onClick={savePrefs} disabled={busy !== ''}>{busy === 'prefs' ? t('در حال ذخیره…') : t('ذخیره ترجیحات')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => digest('DAILY')} disabled={busy !== ''}>{t('ارسال خلاصهٔ روزانه')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => digest('WEEKLY')} disabled={busy !== ''}>{t('ارسال خلاصهٔ هفتگی')}</button>
            </div>
          </SectionCard>
        </div>

        <SectionCard title={t('گزارش تحویل')} icon={<Mail size={17} />} description={t('سوابق ارسال اعلان و خلاصهٔ دوره‌ای در کانال‌ها')}>
          {log.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Mail size={24} /></div>
              <strong>{t('تحویلی ثبت نشده است')}</strong>
              <p>{t('پس از اولین ارسال اعلان یا خلاصهٔ دوره‌ای، سوابق اینجا نمایش داده می‌شوند.')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {log.map(l => (
                <div className="ai-match-card" key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`stat-ico ${l.accepted ? 'ic-green' : 'ic-red'}`} style={{ width: 30, height: 30, borderRadius: 9, flex: '0 0 auto' }}>{l.accepted ? <CheckCircle2 size={14} /> : <BellOff size={14} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 12.5 }}>{l.title}</b>
                    <div className="match-meta">
                      {CHANNEL_FA[l.channel] ?? l.channel} · {l.provider}{l.count != null ? ` · ${fmtN(l.count)} ${t('گیرنده')}` : ''} · {fmtTime(l.createdAt)}
                    </div>
                  </div>
                  <span className={`chip ${l.accepted ? 'success' : 'danger'}`}>{l.accepted ? t('تحویل شد') : t('خطا')}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </>)}
    </main>
  );
}
