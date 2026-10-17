'use client';
import Link from 'next/link';
import { useState } from 'react';
import { clearStoredExportApproval, downloadReport, storedExportApprovalId } from '../../_lib/report-export';
import { ErrorCard, PageHeader } from '../../_components/page-ui';
import { useWorkspace } from '../../_components/workspace';
import { CheckCircle2, Clock3, FileDown, RefreshCw, ShieldCheck, X } from 'lucide-react';

const KIND_FA: Record<string, string> = {
  'relationship-health': 'سلامت روابط', 'relationship-risk': 'روابط پرریسک', company: 'شرکت‌ها',
  contact: 'اشخاص و تماس‌ها', meeting: 'جلسات', commitment: 'تعهدات', action: 'اقدامات',
  opportunity: 'فرصت‌ها', network: 'نمای شبکه', risk: 'ماتریس ریسک', influence: 'نفوذ اشخاص',
  executive: 'مدیران اجرایی', referral: 'معرفی‌ها', project: 'پروژه‌ها',
  'subsidiary-comparison': 'مقایسهٔ زیرمجموعه‌ها', holding: 'ساختار هلدینگ', 'executive-summary': 'خلاصهٔ مدیریت ارشد',
};
const KINDS = Object.keys(KIND_FA);

export default function ExportPage() {
  const { can } = useWorkspace();
  const canJson = can('enterprise.admin');
  const [kind, setKind] = useState('executive-summary');
  const [format, setFormat] = useState('csv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState(false);

  async function run() {
    setBusy(true); setError(''); setNotice(''); setPending(false); setOk(false);
    try {
      const result = await downloadReport(kind, format as 'csv' | 'xlsx' | 'pdf' | 'json', () => {});
      if (result.status === 'downloaded') {
        await clearStoredExportApproval(kind); // درخواست تأیید مصرف شد؛ خروجی بعدی درخواست تازه می‌گیرد
        setOk(true);
        setNotice(`فایل ${format.toUpperCase()} گزارش «${KIND_FA[kind] ?? kind}» دانلود شد و در لاگ خروجی داده ثبت گردید.`);
      } else if (result.status === 'approval_pending') {
        setPending(true);
        setNotice(`درخواست خروجی ${format.toUpperCase()} «${KIND_FA[kind] ?? kind}» ثبت شد (شناسه: ${result.approvalId}).`);
      } else setError(result.message);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(false); }
  }

  const storedId = storedExportApprovalId(kind);
  const formats: Array<[string, string]> = [['csv', 'CSV'], ['xlsx', 'XLSX'], ['pdf', 'PDF'], ...(canJson ? [['json', 'JSON'] as [string, string]] : [])];

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="گزارش‌گیری"
        title="خروجی سریع گزارش"
        description="خروجی تحت مجوز، محدودهٔ دسترسی، تأیید دو مرحله‌ای و ممیزی انجام می‌شود: سرور فایل را تنها با درخواست تأییدِ (EXPORT) تأییدشده برمی‌گرداند و هر دانلود در لاگ خروجی داده ثبت می‌شود. در محیط دمو، XLSX و PDF به‌صورت CSV تحویل می‌شوند."
        actions={<Link className="btn btn-ghost" href="/reports"><FileDown size={15} /> گزارش‌ها و پیش‌نمایش</Link>}
      />
      <ErrorCard message={error} />
      {notice && (
        <div className="notice" role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {pending ? <Clock3 size={16} className="t-warning" /> : <CheckCircle2 size={16} className="t-success" />}
          <span style={{ flex: 1 }}>{notice}</span>
          {pending ? <Link className="btn btn-secondary btn-sm" href="/approvals">رفتن به تأییدها</Link> : null}
        </div>
      )}
      {storedId && (
        <div className="notice" role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ShieldCheck size={15} />
          <span style={{ flex: 1 }}>
            {pending
              ? 'این درخواست در انتظار تصمیم است.'
              : 'درخواست خروجی قبلی برای این گزارش ثبت شده است؛ اگر تأیید شده دوباره «دریافت فایل» را بزنید و اگر رد شده، درخواست قبلی را پاک کنید.'}{' '}
            <code dir="ltr" style={{ fontSize: 10.5 }}>{storedId}</code>
          </span>
          <button className="btn btn-secondary btn-sm" onClick={async () => { await clearStoredExportApproval(kind); setNotice('درخواست قبلی پاک شد؛ می‌توانید درخواست جدید ثبت کنید.'); setPending(false); }}>
            <X size={13} /> پاک کردن درخواست قبلی
          </button>
        </div>
      )}
      <section className="panel form-grid">
        <label>
          <span className="field-label">نوع گزارش</span>
          <select value={kind} onChange={e => { setKind(e.target.value); setNotice(''); setError(''); setPending(false); setOk(false); }}>
            {KINDS.map(k => <option key={k} value={k}>{KIND_FA[k]}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">قالب</span>
          <select value={format} onChange={e => setFormat(e.target.value)}>
            {formats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button className="btn btn-primary" disabled={busy} onClick={run} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {busy ? <RefreshCw size={15} className="spin" /> : <FileDown size={15} />} {busy ? 'در حال دریافت…' : 'دریافت فایل خروجی'}
          </button>
          {!canJson && <span className="t-muted" style={{ fontSize: 11 }}>فرمت JSON فقط برای مدیران سازمانی.</span>}
        </div>
      </section>
      <p className="muted">
        گردش کار: ۱) «دریافت فایل» → درخواست تأیید EXPORT ثبت می‌شود · ۲) مالک از صفحهٔ «تأییدها» تصمیم می‌گیرد · ۳) دوباره «دریافت فایل» → فایل صادر و در لاگ خروجی داده ثبت می‌شود.
      </p>
    </main>
  );
}
