'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  FileDown, RefreshCw, Search, Plus, X, CheckCircle2, ShieldCheck,
  Database, UserRound, FileSpreadsheet, FileJson2, FileText, Table2, CloudDownload, Scale, AlertTriangle, Globe2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  کنترل خروجی داده — لاگ خروجی‌های حساس (پاریتی DataExportLog)        */
/* ------------------------------------------------------------------ */

type ExportRow = {
  id: string; exportType: string; entityType?: string | null;
  recordCount: number; classification: string;
  requestId?: string | null; ipAddress?: string | null;
  createdAt: string;
  userId?: string; userName?: string; userEmail?: string | null;
  organizationName?: string | null;
};

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const fmtDT = (iso?: string | null) => iso
  ? new Date(iso).toLocaleString('fa-IR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? x?.exports ?? []);

const EXPORT_TYPE_FA: Record<string, string> = {
  'relationship-health': 'سلامت روابط', company: 'فهرست شرکت‌ها', contact: 'اشخاص و تماس‌ها',
  meeting: 'جلسات', commitment: 'تعهدات', action: 'اقدامات', opportunity: 'فرصت‌ها',
  project: 'پروژه‌ها', network: 'شبکه', risk: 'ریسک‌ها', influence: 'نفوذ اشخاص',
  referral: 'معرفی‌ها', holding: 'هلدینگ', 'subsidiary-comparison': 'مقایسهٔ زیرمجموعه‌ها',
  'executive-summary': 'خلاصهٔ اجرایی', 'data-privacy': 'دادهٔ حریم خصوصی',
};
const CLASS_FA: Record<string, string> = {
  PUBLIC: 'عمومی', INTERNAL: 'داخلی', CONFIDENTIAL: 'محرمانه', RESTRICTED: 'محدود',
  PRIVATE: 'خصوصی', HIGHLY_CONFIDENTIAL: 'بسیار محرمانه',
};
const CLASS_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  PUBLIC: 'success', INTERNAL: 'info', CONFIDENTIAL: 'warning', RESTRICTED: 'warning',
  PRIVATE: 'danger', HIGHLY_CONFIDENTIAL: 'danger',
};
const TYPE_ICON: Record<string, React.ReactNode> = {
  'relationship-health': <Scale size={12} />, company: <Database size={12} />, contact: <UserRound size={12} />,
  network: <Globe2 size={12} />, risk: <AlertTriangle size={12} />,
};
const EXPORT_FORMATS = ['CSV', 'XLSX', 'PDF', 'JSON'];
// نمایش دوگانه: ردیف‌های واقعی DataExportLog (exportType=قالب، entityType=گزارش) و ردیف‌های دستی قدیمی (exportType=نام گزارش)
const exportMeta = (r: ExportRow) => {
  const fmt = String(r.exportType ?? '').toUpperCase();
  if (EXPORT_FORMATS.includes(fmt)) {
    const kindLabel = EXPORT_TYPE_FA[String(r.entityType ?? '')] ?? String(r.entityType ?? r.exportType);
    const icon = fmt === 'CSV' ? <FileSpreadsheet size={12} /> : fmt === 'XLSX' ? <Table2 size={12} /> : fmt === 'PDF' ? <FileText size={12} /> : <FileJson2 size={12} />;
    return { main: kindLabel, sub: `${fmt} · ${r.entityType ?? ''}`.trim(), search: `${kindLabel} ${fmt} ${r.entityType ?? ''}`.toLowerCase(), icon };
  }
  return { main: EXPORT_TYPE_FA[r.exportType] ?? r.exportType, sub: r.entityType ? `${r.exportType} · ${r.entityType}` : r.exportType, search: `${EXPORT_TYPE_FA[r.exportType] ?? r.exportType} ${r.exportType} ${r.entityType ?? ''}`.toLowerCase(), icon: TYPE_ICON[r.exportType] ?? <FileSpreadsheet size={12} className="t-muted" /> };
};
const CLASSIFICATION_OPTIONS = ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'HIGHLY_CONFIDENTIAL'];
const EXPORT_TYPES = Object.keys(EXPORT_TYPE_FA);

export default function AdminExportsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [rows, setRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [busy, setBusy] = useState(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ exportType: 'relationship-health', recordCount: '0', classification: 'CONFIDENTIAL' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setRows(unwrap(await api<ExportRow[]>('/enterprise/exports'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const high = rows.filter(r => ['RESTRICTED', 'HIGHLY_CONFIDENTIAL', 'PRIVATE'].includes(r.classification)).length;
    const approved = rows.filter(r => r.requestId).length;
    const totalCount = rows.reduce((a, r) => a + (r.recordCount ?? 0), 0);
    const actors = new Set(rows.map(r => r.userEmail ?? r.userName ?? '?')).size;
    return { total: rows.length, high, approved, totalCount, actors };
  }, [rows]);

  const actors = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { const a = r.userEmail ?? r.userName; if (a) set.add(a); });
    return [...set];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      if (classFilter && r.classification !== classFilter) return false;
      if (actorFilter === 'self' && r.userEmail !== me?.email) return false;
      if (actorFilter && actorFilter !== 'self' && (r.userEmail ?? r.userName) !== actorFilter) return false;
      if (term && !exportMeta(r).search.includes(term)) return false;
      return true;
    });
  }, [rows, q, classFilter, actorFilter, me?.email]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const created = await api<ExportRow>('/enterprise/exports', {
        method: 'POST',
        body: JSON.stringify({
          exportType: form.exportType,
          entityType: EXPORT_TYPE_FA[form.exportType] ? undefined : form.exportType,
          recordCount: Number(form.recordCount) || 0,
          classification: form.classification,
          requestId: form.classification === 'HIGHLY_CONFIDENTIAL' ? `ap-${Date.now()}` : null,
        }),
      });
      setRows(list => [created, ...list]);
      setOpen(false);
      setFlash(`خروجی «${EXPORT_TYPE_FA[created.exportType] ?? created.exportType}» ثبت شد (${fmtNum(created.recordCount)} رکورد · ${CLASS_FA[created.classification] ?? created.classification}).`);
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / کنترل خروجی داده" title="کنترل خروجی داده" description="تاریخچه و کنترل خروجی‌های حساس." />
        <div className="empty-state-v4">
          <div className="empty-ico"><FileDown size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای کنترل خروجی داده به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / کنترل خروجی داده"
        title="کنترل خروجی داده"
        description="لاگِ فقط‌افزودنی خروجی‌های داده: نوع، طبقه‌بندی، تعداد رکورد، بازیگر و تأیید دوم‌نفره برای داده‌های حساس — منطبق با سیاست طبقه‌بندی و ممیزی."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={() => { setError(''); setFormError(''); setForm({ exportType: 'relationship-health', recordCount: '0', classification: 'CONFIDENTIAL' }); setOpen(true); }} disabled={busy}>
              <FileDown size={16} /> ثبت خروجی
            </button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 400 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<FileDown size={18} />} label="کل خروجی‌ها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در بازهٔ نگهداری لاگ" />
            <StatCard icon={<ShieldCheck size={18} />} label="خروجی حساس" value={fmtNum(stats.high)} iconClass="ic-gold" sub="محدود/بسیار محرمانه/خصوصی" />
            <StatCard icon={<CheckCircle2 size={18} />} label="دارای تأیید" value={fmtNum(stats.approved)} iconClass="ic-teal" sub="تأیید دوم‌نفره" />
            <StatCard icon={<Database size={18} />} label="رکوردهای خارج‌شده" value={fmtNum(stats.totalCount)} iconClass="ic-red" sub="مجموع همهٔ خروجی‌ها" />
            <StatCard icon={<UserRound size={18} />} label="بازیگران" value={fmtNum(stats.actors)} iconClass="ic-teal" sub="کاربرانِ خروجی‌گیرنده" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نوع یا نهاد خروجی…">
            <select aria-label="فیلتر طبقه‌بندی" value={classFilter} onChange={e => setClassFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ طبقه‌بندی‌ها</option>
              {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{CLASS_FA[c]}</option>)}
            </select>
            <select aria-label="فیلتر بازیگر" value={actorFilter} onChange={e => setActorFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ بازیگران</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="chip info">{fmtNum(filtered.length)} خروجی</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>خروجی‌ای یافت نشد</strong>
              <p>فیلترها یا عبارت جستجو را تغییر دهید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>نوع خروجی</th>
                    <th>طبقه‌بندی</th>
                    <th>رکوردها</th>
                    <th>بازیگر</th>
                    <th>سازمان</th>
                    <th>زمان</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {exportMeta(r).icon}
                          <b className="t-primary" style={{ fontSize: 12.5 }}>{exportMeta(r).main}</b>
                        </span>
                        <div><code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{exportMeta(r).sub}</code></div>
                        {r.requestId && (
                          <div><Badge tone="success" ><CheckCircle2 size={10} /> تأیید {String(r.requestId).slice(0, 8)}</Badge></div>
                        )}
                      </td>
                      <td><Badge tone={CLASS_TONE[r.classification] ?? 'neutral'}>{CLASS_FA[r.classification] ?? r.classification}</Badge></td>
                      <td><span className="cell-count"><Database size={12} /> {fmtNum(r.recordCount ?? 0)}</span></td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <UserRound size={12} className="t-muted" />
                          <span style={{ fontSize: 12 }}>{r.userName ?? '—'}</span>
                        </span>
                        {r.userEmail && <div className="t-muted" dir="ltr" style={{ fontSize: 10 }}>{r.userEmail}</div>}
                      </td>
                      <td><span className="t-muted" style={{ fontSize: 12 }}>{r.organizationName ?? '—'}</span></td>
                      <td><span className="t-muted" style={{ fontSize: 11.5 }}>{fmtDT(r.createdAt)}</span></td>
                      <td><code dir="ltr" style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{r.ipAddress ?? '—'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- record export ------- */}
      <Modal
        open={open}
        title="ثبت خروجی داده"
        description="این عملیات یک رکورد خروجی در لاگ کنترل داده (و ممیزی) ثبت می‌کند."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="ex-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <FileDown size={14} />} ثبت در لاگ
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="ex-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">نوع خروجی <i className="req">*</i></span>
              <select value={form.exportType} onChange={e => setForm(f => ({ ...f, exportType: e.target.value }))}>
                {EXPORT_TYPES.map(t => <option key={t} value={t}>{EXPORT_TYPE_FA[t]}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">طبقه‌بندی <i className="req">*</i></span>
              <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}>
                {CLASSIFICATION_OPTIONS.map(c => <option key={c} value={c}>{CLASS_FA[c]}</option>)}
              </select>
              <small className="t-muted">محدود و بالاتر نیازمند تأیید دوم‌نفره است.</small>
            </label>
            <label className="field">
              <span className="field-label">تعداد رکورد</span>
              <input
                dir="ltr" style={{ textAlign: 'left' }} type="number" min={0}
                value={form.recordCount} onChange={e => setForm(f => ({ ...f, recordCount: e.target.value }))}
              />
            </label>
          </div>
        </form>
      </Modal>
    </main>
  );
}
