'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import { BellRing, Copy, KeyRound, Link2, Plus, ShieldCheck, Terminal, Webhook, XCircle } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   API عمومی + وب‌هوک (مسترپلن فاز ۳/۱۹) — الگوی اکوسیستم شریک Intapp
   کلید API مستأجر با دامنهٔ مجوز (graph:read / insights:read) + نرخ‌محدود
   ۶۰ درخواست در ساعت؛ وب‌هوک با امضای HMAC-SHA256 برای رویدادهای کلیدی.
   این صفحه = کنسول مدیریت + سند عمومی + نمونه‌کد.
   ═══════════════════════════════════════════════════════════════════════════ */

type KeyRow = { id: string; name: string; masked: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; requestCount: number; rateLimitedCount: number };
type WebhookRow = { id: string; url: string; events: string[]; eventFa: string[]; active: boolean; createdAt: string; secretMasked?: string };
type Delivery = { id: string; webhookId: string; event: string; eventFa: string; status: string; responseStatus: number | null; signature: string; createdAt: string; durationMs: number | null; error: string | null };
type Usage = { items: KeyRow[]; rateLimit: { max: number; fa: string }; publicEndpoints: { method: string; path: string; scope: string | null; fa: string }[] };

const SCOPE_FA: Record<string, string> = { 'graph:read': 'خواندن گراف روابط', 'insights:read': 'خواندن تحلیل‌ها' };
const EVENT_FA: Record<string, string> = { RELATIONSHIP_SCORE_CHANGED: 'تغییر امتیاز رابطه', MEDIA_MENTION_DETECTED: 'شناسایی ذکر رسانه‌ای', COMMITMENT_OVERDUE: 'تعهد معوق', PUBLIC_SUBMISSION_RECEIVED: 'پیام پورتال عمومی' };
const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));

const CURL_SAMPLE = `# ۱) کلید بسازید (در همین صفحه) و در هدر بگذارید
curl -H "X-API-Key: srip_ak_…" \\
  https://<host>/api/v1/public/whoami

# ۲) فهرست سازمان‌ها (دامنهٔ graph:read)
curl -H "X-API-Key: srip_ak_…" \\
  "https://<host>/api/v1/public/organizations?q=پارس"

# ۳) امتیاز رابطهٔ دو سازمان
curl -H "X-API-Key: srip_ak_…" \\
  "https://<host>/api/v1/public/relationships/score?from=org-pars&to=org-pars-01"

# ۴) شکاف‌های پوشش عمومی (دامنهٔ insights:read)
curl -H "X-API-Key: srip_ak_…" \\
  "https://<host>/api/v1/public/insights/gaps?organizationId=org-pars"

/* ۵) تأیید امضای وب‌هوک (Node.js) */
const sig = crypto.createHmac('sha256', process.env.SRIP_WEBHOOK_SECRET)
  .update(rawBody).digest('hex');
if ('sha256=' + sig !== req.headers['x-srip-signature']) return res.status(401).end();`;

export default function DevelopersPage() {
  const { can } = useWorkspace();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['graph:read']);
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>(['RELATIONSHIP_SCORE_CHANGED']);
  const [newKey, setNewKey] = useState<string>('');
  const [newSecret, setNewSecret] = useState<string>('');
  const canManage = can('integration.read');

  const load = useCallback(async () => {
    if (!canManage) { setLoading(false); return; }
    try {
      const [k, u, w, d] = await Promise.all([
        apiGet<{ items: KeyRow[] }>('/developer/keys'),
        apiGet<Usage>('/developer/usage'),
        apiGet<{ items: WebhookRow[] }>('/developer/webhooks'),
        apiGet<{ items: Delivery[] }>('/developer/webhook-deliveries'),
      ]);
      setKeys(k.items ?? []); setUsage(u); setHooks(w.items ?? []); setDeliveries(d.items ?? []);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    setBusy(true); setError(''); setFlash(''); setNewKey('');
    try {
      const r = await api<{ key: string; masked: string }>('/developer/keys', { method: 'POST', body: JSON.stringify({ name: keyName, scopes: keyScopes }) });
      setNewKey(r.key); setKeyName('');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const revokeKey = async (id: string) => {
    setBusy(true); setError('');
    try { await api(`/developer/keys/${id}/revoke`, { method: 'POST', body: '{}' }); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const createHook = async () => {
    setBusy(true); setError(''); setFlash(''); setNewSecret('');
    try {
      const r = await api<{ secret: string }>('/developer/webhooks', { method: 'POST', body: JSON.stringify({ url: hookUrl, events: hookEvents }) });
      setNewSecret(r.secret); setHookUrl('');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const testHook = async (id: string) => {
    setBusy(true); setError('');
    try {
      const r = await api<{ sent: number }>(`/developer/webhooks/${id}/test`, { method: 'POST', body: '{}' });
      setFlash(r.sent ? 'رویداد آزمایشی پخش شد — تاریخچهٔ تحویل را ببینید.' : 'ارسالی انجام نشد (آدرس در دسترس نیست).');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const activeKeys = keys.filter(k => !k.revokedAt);
  const okDeliveries = deliveries.filter(d => d.status === 'DELIVERED').length;

  return (
    <>
      <PageHeader
        eyebrow="مسترپلن فاز ۳/۱۹ — الگوی اکوسیستم شریک Intapp/DealCloud"
        title="API عمومی و وب‌هوک"
        description="کلید API مستأجر با دامنهٔ مجوز و نرخ‌محدود برای شریک‌ها، به‌علاوهٔ وب‌هوک امضاشده (HMAC-SHA256) برای رویدادهای کلیدی: تغییر امتیاز رابطه، ذکر رسانه‌ای، تعهد معوق و پیام پورتال."
      />
      {error && <ErrorCard message={error} />}
      {flash && <div className="flash" role="status">{flash}</div>}
      {loading ? <Loading /> : !canManage ? (
        <p className="pp-muted">برای مشاهدهٔ کنسول توسعه‌دهنده مجوز «یکپارچه‌سازی‌ها» لازم است.</p>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<KeyRound size={18} />} label="کلیدهای فعال" value={fmtN(activeKeys.length)} iconClass="ic-blue" sub={`سقف ${usage?.rateLimit?.fa ?? ''}`} />
            <StatCard icon={<Terminal size={18} />} label="مسیرهای عمومی" value={fmtN(usage?.publicEndpoints?.length ?? 0)} iconClass="ic-teal" sub="فقط-خواندنی با کلید مستأجر" />
            <StatCard icon={<Webhook size={18} />} label="وب‌هوک‌های فعال" value={fmtN(hooks.filter(h => h.active).length)} iconClass="ic-indigo" sub={`${fmtN(hookEventsAll().length)} رویداد کلیدی`} />
            <StatCard icon={<ShieldCheck size={18} />} label="تحویل موفق (آخرین)" value={fmtN(okDeliveries)} iconClass="ic-purple" sub={`از ${fmtN(deliveries.length)} تحویل ثبت‌شده`} />
          </div>

          <SectionCard title="کلیدهای API" icon={<KeyRound size={16} />}
            description="کلید فقط هنگام ساخته‌شدن یک‌بار نمایش داده می‌شود — آن را ذخیره کنید. دامنه‌ها دسترسی را محدود می‌کنند.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ margin: 0, flex: '1 1 180px' }}>
                <span className="field-label">نام کلید</span>
                <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="مثلاً یکپارچه‌سازی CRM" />
              </label>
              <div className="field" style={{ margin: 0 }}>
                <span className="field-label">دامنهٔ مجوز</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                  {Object.keys(SCOPE_FA).map(s => (
                    <label key={s} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <input type="checkbox" checked={keyScopes.includes(s)} onChange={e => setKeyScopes(prev => e.target.checked ? [...new Set([...prev, s])] : prev.filter(x => x !== s))} />
                      {SCOPE_FA[s]}
                    </label>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" disabled={busy || !keyName.trim() || !keyScopes.length} onClick={createKey}>
                <Plus size={14} /> ساخت کلید
              </button>
            </div>
            {newKey && (
              <div className="p3-once" role="alert">
                <strong>کلید تازه (فقط همین یک‌بار):</strong>
                <code>{newKey}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => { try { void navigator.clipboard?.writeText?.(newKey); } catch {} setFlash('کلید نمایش داده شد — آن را در جای امن ذخیره کنید.'); setNewKey(''); }}>
                  <Copy size={13} /> ذخیره کردم
                </button>
              </div>
            )}
            {keys.length > 0 && (
              <div className="p3-list" style={{ marginTop: 10 }}>
                {keys.map(k => (
                  <div key={k.id} className="p3-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <strong style={{ fontSize: 12.5 }}>{k.name}</strong>
                        <code style={{ fontSize: 11, direction: 'ltr' }}>{k.masked}</code>
                        {k.scopes.map(s => <span key={s} className="p3-chip">{SCOPE_FA[s] ?? s}</span>)}
                        {k.revokedAt ? <Badge tone="danger">لغوشده</Badge> : <Badge tone="success">فعال</Badge>}
                      </div>
                      <p className="pp-muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>
                        {fmtN(k.requestCount)} درخواست{k.rateLimitedCount ? ` · ${fmtN(k.rateLimitedCount)} بار مسدودشده در سقف نرخ` : ''}{k.lastUsedAt ? ` · آخرین استفاده ${new Date(k.lastUsedAt).toLocaleDateString('fa-IR')}` : ''}
                      </p>
                    </div>
                    {!k.revokedAt && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => revokeKey(k.id)}><XCircle size={13} /> لغو</button>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="وب‌هوک‌ها" icon={<BellRing size={16} />}
            description="برای هر رویداد کلیدی، یک POST با امضای HMAC-SHA256 در هدر X-Srip-Signature به نشانی شما ارسال می‌شود.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="field" style={{ margin: 0, flex: '1 1 220px' }}>
                <span className="field-label">نشانی دریافت (https://…)</span>
                <input value={hookUrl} onChange={e => setHookUrl(e.target.value)} dir="ltr" placeholder="https://partner.example.ir/srip-hook" />
              </label>
              <div className="field" style={{ margin: 0 }}>
                <span className="field-label">رویدادها</span>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12.5 }}>
                  {hookEventsAll().map(ev => (
                    <label key={ev} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <input type="checkbox" checked={hookEvents.includes(ev)} onChange={e => setHookEvents(prev => e.target.checked ? [...new Set([...prev, ev])] : prev.filter(x => x !== ev))} />
                      {EVENT_FA[ev] ?? ev}
                    </label>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" disabled={busy || !hookUrl.trim() || !hookEvents.length} onClick={createHook}>
                <Plus size={14} /> افزودن وب‌هوک
              </button>
            </div>
            {newSecret && (
              <div className="p3-once" role="alert">
                <strong>رمز امضا (فقط همین یک‌بار):</strong>
                <code>{newSecret}</code>
                <button className="btn btn-secondary btn-sm" onClick={() => { try { void navigator.clipboard?.writeText?.(newSecret); } catch {} setFlash('رمز امضا نمایش داده شد — آن را در جای امن ذخیره کنید.'); setNewSecret(''); }}>
                  <Copy size={13} /> ذخیره کردم
                </button>
              </div>
            )}
            {hooks.length > 0 && (
              <div className="p3-list" style={{ marginTop: 10 }}>
                {hooks.map(h => (
                  <div key={h.id} className="p3-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link2 size={13} style={{ flexShrink: 0 }} />
                        <code style={{ fontSize: 11.5, direction: 'ltr', wordBreak: 'break-all' }}>{h.url}</code>
                        {h.active ? <Badge tone="success">فعال</Badge> : <Badge tone="danger">غیرفعال</Badge>}
                      </div>
                      <p className="pp-muted" style={{ margin: '4px 0 0', fontSize: 11.5 }}>{h.eventFa.join('، ')}</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => testHook(h.id)}>ارسال آزمایشی</button>
                  </div>
                ))}
              </div>
            )}
            {deliveries.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table className="p3-table" style={{ minWidth: 560 }}>
                  <thead><tr><th>رویداد</th><th>وضعیت</th><th>امضا</th><th>زمان</th></tr></thead>
                  <tbody>
                    {deliveries.slice(0, 10).map(d => (
                      <tr key={d.id}>
                        <td style={{ fontSize: 12 }}>{d.eventFa ?? d.event}</td>
                        <td><Badge tone={d.status === 'DELIVERED' ? 'success' : 'danger'}>{d.status === 'DELIVERED' ? `تحویل‌شده (${fmtN(d.responseStatus ?? 0)})` : 'ناموفق'}</Badge></td>
                        <td><code style={{ fontSize: 10.5, direction: 'ltr' }}>{String(d.signature ?? '').slice(0, 22)}…</code></td>
                        <td style={{ fontSize: 12 }}>{new Date(d.createdAt).toLocaleString('fa-IR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="سند عمومی API" icon={<Terminal size={16} />}
            description="مسیرهای فقط-خواندنی با احراز کلید؛ نرخ‌محدود ۶۰ درخواست در ساعت برای هر کلید.">
            <div style={{ overflowX: 'auto' }}>
              <table className="p3-table" style={{ minWidth: 520 }}>
                <thead><tr><th>روش</th><th>مسیر</th><th>دامنه</th><th>توضیح</th></tr></thead>
                <tbody>
                  {(usage?.publicEndpoints ?? []).map(e => (
                    <tr key={e.path}>
                      <td><Badge tone="info">{e.method}</Badge></td>
                      <td><code style={{ fontSize: 11, direction: 'ltr' }}>{e.path}</code></td>
                      <td style={{ fontSize: 12 }}>{e.scope ? <code style={{ fontSize: 10.5, direction: 'ltr' }}>{e.scope}</code> : '—'}</td>
                      <td style={{ fontSize: 12 }}>{e.fa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.9, overflow: 'auto', direction: 'ltr', marginTop: 10 }}>{CURL_SAMPLE}</pre>
            <p className="pp-muted" style={{ fontSize: 11.5, marginTop: 8 }}>خطاها: 401 کلید نامعتبر/لغوشده · 403 دامنهٔ ناکافی · 404 خارج از محدودهٔ کلید · 429 سقف نرخ. دادهٔ هر کلید فقط از دنیای همان مستأجر است.</p>
          </SectionCard>
        </>
      )}
    </>
  );
}

function hookEventsAll() { return Object.keys(EVENT_FA); }
