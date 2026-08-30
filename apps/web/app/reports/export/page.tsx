'use client';
import { useState } from 'react';
import { PageHeader, Empty, ErrorCard } from '../../_components/page-ui';
import { clearStoredExportApproval, downloadReport, storedExportApprovalId } from '../../_lib/report-export';
import { useWorkspace } from '../../_components/workspace';

const KINDS = ['relationship-health', 'company', 'contact', 'meeting', 'commitment', 'action', 'opportunity', 'network', 'risk', 'influence', 'referral', 'project', 'subsidiary-comparison', 'holding', 'executive-summary'];

export default function Export() {
  const { can } = useWorkspace();
  const canExport = can('report.export');
  const [kind, setKind] = useState('relationship-health');
  const [format, setFormat] = useState('csv');
  const [e, setE] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!canExport) return;
    setBusy(true); setE(''); setNotice('');
    try {
      const result = await downloadReport(kind, format as 'csv' | 'xlsx' | 'pdf' | 'json', () => {
        setNotice('درخواست تأیید خروجی ثبت شد. یک کاربر دارای مجوز تأیید باید آن را از صفحه «تأییدها» تأیید کند؛ سپس دوباره «دریافت فایل» را بزنید.');
      });
      if (result.status === 'error') setE(result.message);
      if (result.status === 'approval_pending') setNotice('خروجی نیاز به تأیید دارد. پس از تأیید درخواست، دوباره «دریافت فایل» را بزنید.');
    } finally { setBusy(false); }
  }

  const stored = storedExportApprovalId(kind);

  if (!canExport) return <main className="feature-page"><PageHeader eyebrow="REPORTING" title="Export گزارش" description="خروجی گزارش‌ها فقط برای کاربران دارای مجوز در دسترس است." /><section className="panel"><Empty>مجوز تهیه خروجی گزارش برای شما فعال نیست.</Empty></section></main>;

  return (
    <main className="feature-page">
      <PageHeader eyebrow="REPORTING" title="Export گزارش" description="Export تحت Authorization، Scope، Approval (دو نفره) و Audit انجام می‌شود. بدون تأیید ثبت‌شده، Backend خروجی را بر نمی‌گرداند." />
      <ErrorCard message={e} />
      {notice && <div className="notice" role="status">{notice} <a href="/approvals">رفتن به صفحه تأییدها</a></div>}
      {stored && <div className="notice">درخواست خروجی قبلی برای این گزارش ثبت شده است.<button className="secondary-action" onClick={async () => { await clearStoredExportApproval(kind); setNotice('درخواست قبلی پاک شد؛ می‌توانید درخواست جدید ثبت کنید.'); }}>پاک کردن درخواست قبلی</button></div>}
      <section className="panel form-grid">
        <label>نوع گزارش
          <select value={kind} onChange={(x) => setKind(x.target.value)}>{KINDS.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <label>فرمت
          <select value={format} onChange={(x) => setFormat(x.target.value)}><option>csv</option><option>xlsx</option><option>json</option><option>pdf</option></select>
        </label>
        <button className="primary-action" disabled={busy} onClick={run}>{busy ? 'در حال دانلود…' : 'دریافت فایل Export'}</button>
      </section>
      <p className="muted">فایل به‌صورت attachment توسط Backend تولید و دانلود می‌شود.</p>
    </main>
  );
}