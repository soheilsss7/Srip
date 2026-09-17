'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import { Bell, BellOff, BellRing, CheckCheck, HardDriveDownload, RefreshCw, Send, Trash2, Wifi, WifiOff } from 'lucide-react';
import { localeTag, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   Web Push + ارتقای PWA (مسترپلن فاز ۳/۲۱) — الگوی اپ‌های نیتیو، مسیر سبک
   رضایت اعلان ملزم است (درخواست مجوز صریح، لغو هر زمان). انتقال پیام در
   دمو = polling از صف سرور؛ در استقرار ترکیبی همان ساختار اشتراک به
   Web Push واقعی (VAPID) وصل می‌شود — سرویس‌ورکر پوش و کلیک اعلان فعال است.
   آفلاین‌پذیری: دارایی‌های بازدیدشده در حافظهٔ محلی سرویس‌ورکر ذخیره می‌شوند.
   ═══════════════════════════════════════════════════════════════════════════ */

type Sub = { id: string; endpointMasked: string; topics: string[]; consent: string; active: boolean; createdAt: string; revokedAt: string | null };
type Pending = { id: string; title: string; body: string; topic: string; createdAt: string };

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));

export default function PushPage() {
  const { can } = useWorkspace();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [received, setReceived] = useState<Pending[]>([]);
  const [permission, setPermission] = useState<string>('default');
  const [swReady, setSwReady] = useState(false);
  const [cacheList, setCacheList] = useState<{ name: string; entries: number }[]>([]);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canWrite = can('publics.write');

  const loadSubs = useCallback(async () => {
    try { setSubs((await apiGet<{ items: Sub[] }>('/notifications/push/subscriptions')).items ?? []); }
    catch (e) { setError((e as Error).message); }
  }, []);

  const loadCaches = useCallback(async () => {
    try {
      if (typeof caches === 'undefined') return;
      const names = await caches.keys();
      const out: { name: string; entries: number }[] = [];
      for (const n of names) {
        const c = await caches.open(n);
        out.push({ name: n, entries: (await c.keys()).length });
      }
      setCacheList(out);
    } catch { /* حالت ناشناخته */ }
  }, []);

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
      await Promise.all([loadSubs(), loadCaches()]);
      setLoading(false);
    })();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadSubs, loadCaches]);

  const ackAll = useCallback(async () => {
    try {
      const pend = await apiGet<{ items: Pending[] }>('/notifications/push/pending');
      for (const p of pend.items ?? []) {
        setReceived(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev].slice(0, 20));
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.showNotification?.(p.title, { body: p.body, dir: 'rtl', lang: 'fa', tag: p.id });
          }
        } catch { /* نمایش سیستم‌اعلان در محیط بدون تعامل ممکن نیست */ }
        await api(`/notifications/push/pending/${p.id}/ack`, { method: 'POST', body: '{}' });
      }
    } catch { /* قطع موقت */ }
  }, []);

  const togglePolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null; setPolling(false);
      return;
    }
    setPolling(true);
    void ackAll();
    pollRef.current = setInterval(() => { void ackAll(); }, 8000);
  };

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') { setError(t('این مرورگر از Notification پشتیبانی نمی‌کند.')); return; }
    try { setPermission(await Notification.requestPermission()); }
    catch { setPermission('denied'); }
  };

  const subscribe = async () => {
    if (permission !== 'granted') { setError(t('ابتدا رضایت اعلان را بگیرید (دکمهٔ «درخواست رضایت اعلان»).')); return; }
    setBusy(true); setError(''); setFlash('');
    try {
      const synthetic = `https://push.srip.local/sub/${crypto.randomUUID?.() ?? String(Date.now())}`;
      const r = await api<{ id: string }>('/notifications/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: synthetic, consent: 'GRANTED', topics: ['PORTAL', 'MEDIA', 'GENERAL'], keys: { p256dh: 'demo-static', auth: 'demo-static' } }),
      });
      setFlash(`${t('اشتراک ثبت شد (')}${r.id.slice(0, 12)}${t('…) — رضایت شما در سرور ذخیره شد.')}`);
      await loadSubs();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    setBusy(true); setError('');
    try { await api(`/notifications/push/subscriptions/${id}/revoke`, { method: 'POST', body: '{}' }); await loadSubs(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const dispatchTest = async () => {
    setBusy(true); setError(''); setFlash('');
    try {
      const r = await api<{ sent: number; message: string }>('/notifications/push/dispatch', { method: 'POST', body: JSON.stringify({ title: t('اعلان آزمون SRIP'), body: t('این پیام از مسیر Web Push (نقل‌ونقل polling در دمو) رسید.') }) });
      setFlash(r.message);
      await ackAll();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const clearOffline = async () => {
    setBusy(true);
    try {
      if (typeof caches !== 'undefined') {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
        await loadCaches();
      }
      setFlash(t('حافظهٔ آفلاین پاک شد — صفحات با بازدید بعدی دوباره ذخیره می‌شوند.'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const activeSubs = subs.filter(s => s.active);
  const runtimeCache = cacheList.find(c => c.name.includes('runtime'));

  return (
    <>
      <PageHeader
        eyebrow={t('مسترپلن فاز ۳/۲۱ — استقرار ترکیبی: هستهٔ استاتیک می‌ماند، سرویس اعلان اختیاری')}
        title={t('اعلان‌ها و آفلاین (PWA)')}
        description={t('اشتراک اعلان فقط با رضایت صریح شما ثبت می‌شود و هر زمان قابل لغو است. پیام‌های پورتال و رسانه به‌طور خودکار به صف اعلان می‌روند. صفحات بازدیدشده برای استفادهٔ بدون اینترنت ذخیره می‌شوند.')}
        actions={
          <button className="btn btn-secondary" onClick={togglePolling}>
            {polling ? <><BellOff size={14} /> {t('توقف دریافت')}</> : <><BellRing size={14} /> {t('شروع دریافت (polling)')}</>}
          </button>
        }
      />
      {error && <ErrorCard message={error} />}
      {flash && <div className="flash" role="status">{flash}</div>}
      {loading ? <Loading /> : (
        <>
          <div className="stat-grid">
            <StatCard icon={permission === 'granted' ? <Bell size={18} /> : <BellOff size={18} />} label={t('رضایت اعلان مرورگر')} value={permission === 'granted' ? t('داده‌شده') : permission === 'denied' ? t('ردشده') : t('خواسته‌نشده')} iconClass={permission === 'granted' ? 'ic-teal' : 'ic-blue'} sub={permission === 'denied' ? t('از تنظیمات مرورگر فعال کنید') : t('قابل لغو در هر زمان')} />
            <StatCard icon={<Wifi size={18} />} label={t('وضعیت شبکه')} value={online ? t('برخط') : t('آفلاین')} iconClass={online ? 'ic-teal' : 'ic-purple'} sub={online ? t('داده تازه‌سازی می‌شود') : t('صفحات بازدیدشده از حافظهٔ محلی')} />
            <StatCard icon={<CheckCheck size={18} />} label={t('اشتراک‌های فعال')} value={fmtN(activeSubs.length)} iconClass="ic-indigo" sub={`${fmtN(subs.length)} ${t('اشتراک ثبت‌شده')}`} />
            <StatCard icon={<HardDriveDownload size={18} />} label={t('حافظهٔ آفلاین')} value={runtimeCache ? `${fmtN(runtimeCache.entries)} ${t('مورد')}` : '—'} iconClass="ic-blue" sub={swReady ? t('سرویس‌ورکر فعال') : t('سرویس‌ورکر نامشخص')} />
          </div>

          <SectionCard title={t('اشتراک اعلان این دستگاه')} icon={<Bell size={16} />}
            description={t('در دمو، انتقال پیام با polling از صف سرور انجام می‌شود (همان ساختار اشتراک Web Push)؛ در استقرار واقعی با VAPID تحویل از سرویس اعلان انجام می‌شود — سرویس‌ورکر پوش و کلیک اعلان از همین حالا فعال است.')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {permission !== 'granted' && <button className="btn btn-secondary" onClick={requestPermission}><Bell size={14} /> {t('درخواست رضایت اعلان')}</button>}
              <button className="btn btn-primary" disabled={busy || permission !== 'granted'} onClick={subscribe}><BellRing size={14} /> {t('اشتراک این دستگاه')}</button>
              {canWrite && <button className="btn btn-secondary" disabled={busy} onClick={dispatchTest}><Send size={14} /> {t('ارسال آزمایشی به حساب')}</button>}
            </div>
            {subs.length > 0 && (
              <div className="p3-list" style={{ marginTop: 10 }}>
                {subs.map(s => (
                  <div key={s.id} className="p3-row">
                    <div style={{ minWidth: 0 }}>
                      <code style={{ fontSize: 11, direction: 'ltr', wordBreak: 'break-all' }}>{s.endpointMasked}</code>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.topics.map(t => <span key={t} className="p3-chip">{t}</span>)}
                        {s.active ? <Badge tone="success">{t('فعال · رضایت داده‌شده')}</Badge> : <Badge tone="danger">{t('لغوشده')}</Badge>}
                      </div>
                    </div>
                    {s.active && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => revoke(s.id)}><BellOff size={13} /> {t('لغو رضایت')}</button>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('پیام‌های دریافت‌شده')} icon={<BellRing size={16} />}
            description={t('با «شروع دریافت»، هر ۸ ثانیه صف بررسی می‌شود؛ پیام تازه با اعلان سیستم (در صورت پشتیبانی) و این فهرست نمایش داده می‌شود. هر پیام پوش هم‌زمان به‌عنوان اعلان درون‌برنامه‌ای سازمان‌محور در صفحهٔ «اعلان‌ها» هم ظاهر می‌شود.')}>
            {received.length === 0 ? (
              <p className="pp-muted">{t('هنوز پیامی دریافت نشده — «شروع دریافت» را بزنید و با «ارسال آزمایشی» یا ثبت پیام در پورتال عمومی، چرخهٔ کامل را ببینید.')}</p>
            ) : (
              <div className="p3-list">
                {received.map(p => (
                  <div key={p.id} className="p3-row" style={{ gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>{p.title}</strong>
                      <p className="pp-muted" style={{ margin: '2px 0 0', fontSize: 12 }}>{p.body}</p>
                    </div>
                    <span className="p3-chip" style={{ flexShrink: 0 }}>{p.topic}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('آفلاین و حافظهٔ محلی')} icon={online ? <Wifi size={16} /> : <WifiOff size={16} />}
            description={t('سرویس‌ورکر صفحات بازدیدشده را ذخیره می‌کند تا بدون اینترنت در دسترس باشند؛ دادهٔ API دمو نیز به‌طور کامل داخل سرویس‌ورکر اجرا می‌شود.')}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge tone={swReady ? 'success' : 'warning'}>{swReady ? t('سرویس‌ورکر فعال') : t('سرویس‌ورکر در این نشست فعال نیست')}</Badge>
              {cacheList.map(c => <span key={c.name} className="p3-chip"><code style={{ direction: 'ltr', fontSize: 10.5 }}>{c.name}</code> · {fmtN(c.entries)} مورد</span>)}
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={clearOffline}><Trash2 size={13} /> {t('پاک‌سازی حافظهٔ آفلاین')}</button>
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={loadCaches}><RefreshCw size={13} /> {t('به‌روزرسانی')}</button>
            </div>
            <p className="pp-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
              صداقت محدوده: پوش واقعی (VAPID) نیازمند سرویس اعلان اختیاری در استقرار ترکیبی است؛ در این دمو ساختار اشتراک/رضایت/صف تحویل همان است و فقط نقل‌ونقل با polling شبیه‌سازی شده است. دریافت در Android/iOS PWA پس از استقرار سرویس اعلان، بدون تغییر این صفحه فعال می‌شود.
            </p>
          </SectionCard>
        </>
      )}
    </>
  );
}
