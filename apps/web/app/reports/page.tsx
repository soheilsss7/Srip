'use client';
import { useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { clearStoredExportApproval, downloadReport, storedExportApprovalId } from '../_lib/report-export';
import { DataTable, ErrorCard, Loading, PageHeader } from '../_components/page-ui';
const kinds = ['relationship-health', 'company', 'contact', 'meeting', 'commitment', 'action', 'opportunity', 'network', 'risk', 'influence', 'referral', 'project', 'subsidiary-comparison', 'holding'];

function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (value === null || typeof value !== 'object') return { [prefix || 'value']: value };
  if (Array.isArray(value)) return { [prefix || 'value']: JSON.stringify(value) };
  const out: Record<string, unknown> = {};
  const input = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(input)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

function previewRows(payload: any): Array<Record<string, unknown>> {
  if (Array.isArray(payload?.data)) return payload.data.map((r: any) => flatten(r));
  const out: Array<Record<string, unknown>> = [];
  for (const [section, value] of Object.entries(payload ?? {})) {
    if (['report', 'generatedAt'].includes(section)) continue;
    if (Array.isArray(value)) (value as unknown[]).forEach((v) => out.push({ section, ...flatten(v) }));
    else if (value && typeof value === 'object') out.push({ section, ...flatten(value) });
    else out.push({ section, value });
  }
  return out;
}

export default function Reports() {
  const [kind, setKind] = useState('relationship-health'), [data, setData] = useState<any>(null), [e, setE] = useState(''), [loading, setLoading] = useState(false), [exporting, setExporting] = useState(''), [notice, setNotice] = useState('');
  async function load(k = kind) {
    setLoading(true); setE('');
    try { setData(await api(`/reports/${encodeURIComponent(k)}`)); }
    catch (x) { setE((x as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function download(format: string) {
    setExporting(format); setE(''); setNotice('');
    const onPending = (approvalId: string) => setNotice("Approval requested: " + approvalId);
    const fmt = format as 'csv' | 'xlsx' | 'pdf' | 'json';
    try {
      const result = await downloadReport(kind, fmt, onPending);
      if (result.status === 'error') setE(result.message);
      if (result.status === 'approval_pending') setNotice("Export needs approval - request created: " + result.approvalId);
    } catch (x) { setE((x as Error).message); } finally { setExporting(''); }
  }
  const rows = previewRows(data);
  const storedApproval = storedExportApprovalId(kind);
  return (
    <main className="feature-page">
      <PageHeader eyebrow="REPORTING" title="گزارش‌ها" description="گزارش‌های Relationship، Organization، Contact، Meeting، Commitment، Action، Opportunity، Network، Risk، Influence، Referral، Project و Executive." actions={<div className="toolbar">{['csv', 'pdf', 'xlsx'].map((f) => <button className="secondary-action" key={f} disabled={!!exporting} onClick={() => download(f)}>{exporting === f ? 'در حال خروجی…' : `Export ${f.toUpperCase()}`}</button>)}</div>} />
      <section className="panel"><label>نوع گزارش<select value={kind} onChange={(e2) => { setKind(e2.target.value); load(e2.target.value); }}>{kinds.map((k) => <option key={k}>{k}</option>)}</select></label></section>
      {notice && <div className="notice" role="status">{notice} <a href="/approvals">تأیید در صفحه تأییدها</a></div>}
      {storedApproval && <div className="notice">درخواست خروجی قبلی برای این گزارش ثبت شده است.<button className="secondary-action" onClick={async () => { await clearStoredExportApproval(kind); setNotice('درخواست قبلی پاک شد.'); }}>پاک کردن</button></div>}
      <ErrorCard message={e} />
      {loading ? <Loading /> : <section className="panel">{rows.length ? <DataTable columns={rows[0] ? Object.keys(rows[0]).slice(0, 10).map((k) => ({ key: k, label: k })) : []} rows={rows} /> : <div className="empty-state">پیش‌نمایشی برای این گزارش در دسترس نیست (ممکن است داده‌ای در محدوده مجاز شما نباشد).</div>}</section>}
    </main>
  );
}