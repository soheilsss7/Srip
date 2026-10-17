'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../_lib/api';
import { ErrorCard } from '../_components/page-ui';
import { downloadCsv, parseCsv, normalizeHeader, PEOPLE_TEMPLATE_HEADERS, PEOPLE_TEMPLATE_SAMPLE } from '../_lib/csv';
import { Download, Upload, FileSpreadsheet, Building2, Users, Share2, CalendarDays, Handshake, CheckCircle2, XCircle, FileDown, RefreshCw, ShieldCheck } from 'lucide-react';

const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

type ExportSpec = {
  key: string; label: string; icon: React.ReactNode; endpoint: string;
  headers: string[]; row: (r: any) => unknown[]; filename: string;
};

const EXPORTS: ExportSpec[] = [
  {
    key: 'organizations', label: 'سازمان‌ها', icon: <Building2 size={16} />, endpoint: '/organizations',
    headers: ['شناسه', 'نام', 'نوع', 'صنعت', 'کشور', 'سازمان مادر', 'تاریخ ایجاد'],
    row: (r) => [r.id, r.name, r.type ?? '', r.industry ?? '', r.country ?? '', r.parentOrganizationId ?? '', r.createdAt ?? ''],
    filename: 'srip-organizations.csv',
  },
  {
    key: 'people', label: 'اشخاص', icon: <Users size={16} />, endpoint: '/people',
    headers: ['شناسه', 'نام', 'نام خانوادگی', 'ایمیل', 'تلفن', 'سمت', 'بخش', 'سازمان', 'وضعیت', 'نفوذ'],
    row: (r) => [r.id, r.firstName, r.lastName ?? '', r.email ?? '', r.phone ?? '', r.title ?? '', r.department ?? '', r.organization?.name ?? '', r.status ?? '', r.influenceScore ?? ''],
    filename: 'srip-people.csv',
  },
  {
    key: 'relationships', label: 'روابط', icon: <Share2 size={16} />, endpoint: '/relationships',
    headers: ['شناسه', 'نوع', 'وضعیت', 'سازمان مبدأ', 'سازمان مقصد', 'سلامت', 'ریسک', 'ارزش راهبردی', 'اقدام بعدی'],
    row: (r) => [r.id, r.relationshipType ?? '', r.status ?? '', r.sourceOrganization?.name ?? '', r.targetOrganization?.name ?? '', r.healthScore ?? '', r.riskScore ?? '', r.strategicScore ?? '', r.nextActionAt ?? ''],
    filename: 'srip-relationships.csv',
  },
  {
    key: 'meetings', label: 'جلسات', icon: <CalendarDays size={16} />, endpoint: '/meetings',
    headers: ['شناسه', 'عنوان', 'شروع', 'پایان', 'هدف', 'نتیجه', 'سازمان'],
    row: (r) => [r.id, r.title, r.startAt ?? '', r.endAt ?? '', r.objective ?? '', r.outcome ?? '', r.organization?.name ?? ''],
    filename: 'srip-meetings.csv',
  },
  {
    key: 'interactions', label: 'تعاملات', icon: <Handshake size={16} />, endpoint: '/interactions',
    headers: ['شناسه', 'موضوع', 'نوع', 'تاریخ', 'نتیجه', 'سازمان'],
    row: (r) => [r.id, r.subject, r.type ?? '', r.occurredAt ?? '', r.outcome ?? '', r.organization?.name ?? ''],
    filename: 'srip-interactions.csv',
  },
];

export default function DataExchangePage() {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [done, setDone] = useState('');

  // import state
  const [orgs, setOrgs] = useState<any[]>([]);
  const [targetOrg, setTargetOrg] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => { api('/organizations').then(d => setOrgs(unwrap(d))).catch(() => {}); }, []);

  const doExport = async (spec: ExportSpec) => {
    setBusy(spec.key); setError(''); setDone('');
    try {
      const data = unwrap(await api(spec.endpoint));
      downloadCsv(spec.filename, spec.headers, data.map(spec.row));
      setDone(`فایل ${spec.filename} دانلود شد (${data.length} ردیف).`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };

  const downloadTemplate = () => {
    downloadCsv('srip-people-template.csv', PEOPLE_TEMPLATE_HEADERS, PEOPLE_TEMPLATE_SAMPLE);
    setDone('قالب ورود اشخاص دانلود شد — ستون «سازمان» اختیاری است؛ در غیر این صورت همه در سازمان انتخابی ثبت می‌شوند.');
  };

  const onFile = async (file: File) => {
    setError(''); setResult(null); setPreview([]); setImportErrors([]);
    if (!/\.csv$/i.test(file.name)) { setError('فقط فایل CSV (سازگار با Excel) پشتیبانی می‌شود.'); return; }
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) { setError('فایل خالی است یا فقط سربرگ دارد.'); return; }
    const headers = rows[0].map(normalizeHeader);
    const fIdx = headers.indexOf('firstName'), lIdx = headers.indexOf('lastName');
    if (fIdx < 0 || lIdx < 0) { setError('ستون‌های «نام» و «نام خانوادگی» در فایل پیدا نشدند.'); return; }
    const eIdx = headers.indexOf('email'), tIdx = headers.indexOf('title'), dIdx = headers.indexOf('department');
    const sIdx = headers.indexOf('status'), iIdx = headers.indexOf('influenceScore');
    const orgIdx = headers.indexOf('organization');
    const errors: string[] = [];
    const parsed = rows.slice(1).map((cells, ri) => {
      const rec: Record<string, string> = {
        firstName: cells[fIdx] ?? '', lastName: cells[lIdx] ?? '',
        email: eIdx >= 0 ? cells[eIdx] ?? '' : '',
        title: tIdx >= 0 ? cells[tIdx] ?? '' : '',
        department: dIdx >= 0 ? cells[dIdx] ?? '' : '',
        status: sIdx >= 0 ? cells[sIdx] ?? '' : 'ACTIVE',
        influenceScore: iIdx >= 0 ? cells[iIdx] ?? '' : '',
        organization: orgIdx >= 0 ? cells[orgIdx] ?? '' : '',
      };
      if (!rec.firstName || !rec.lastName) errors.push(`ردیف ${ri + 2}: نام یا نام خانوادگی خالی است.`);
      if (rec.email && !/^\S+@\S+\.\S+$/.test(rec.email)) errors.push(`ردیف ${ri + 2}: ایمیل نامعتبر «${rec.email}».`);
      return rec;
    });
    setPreview(parsed.slice(0, 8));
    setImportErrors(errors.slice(0, 20));
  };

  const runImport = async () => {
    if (!preview.length) return;
    setBusy('import'); setError(''); setResult(null);
    const created: string[] = []; const failed: string[] = [];
    for (const rec of preview) {
      if (!rec.firstName || !rec.lastName) { failed.push(`${rec.firstName ?? ''} ${rec.lastName ?? ''}`); continue; }
      try {
        await api('/people', {
          method: 'POST',
          body: JSON.stringify({
            firstName: rec.firstName, lastName: rec.lastName,
            email: rec.email || undefined, title: rec.title || undefined,
            department: rec.department || undefined, organizationId: targetOrg,
          }),
        });
        created.push(`${rec.firstName} ${rec.lastName}`);
      } catch { failed.push(`${rec.firstName} ${rec.lastName}`); }
    }
    setResult({ created: created.length, failed: failed.length, errors: failed });
    setDone('');
  };

  const orgOptions = useMemo(() => orgs, [orgs]);

  return (
    <main className="feature-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">فضای کاری SRIP · تبادل داده</div>
          <h1><FileSpreadsheet size={20} style={{ verticalAlign: '-4px' }}/> تبادل داده</h1>
          <p className="subtitle">خروجی فهرست‌ها به فایل Excel-compatible (CSV با پشتیبانی فارسی) و ورود گروهی اشخاص با پیش‌نمایش و اعتبارسنجی — همیشه در محدودهٔ دسترسی شما.</p>
        </div>
        <div className="heading-tools">
          <span className="chip info"><ShieldCheck size={12}/> فقط محدودهٔ مجاز</span>
        </div>
      </section>

      <ErrorCard message={error} />
      {done && <div className="success-card" role="status"><CheckCircle2 size={15}/> {done}</div>}

      <div className="page-toolbar">
        <button className={`tab ${tab === 'export' ? 'active' : ''}`} onClick={() => { setTab('export'); setError(''); }}>
          <Download size={14}/> خروجی
        </button>
        <button className={`tab ${tab === 'import' ? 'active' : ''}`} onClick={() => { setTab('import'); setError(''); }}>
          <Upload size={14}/> ورودی
        </button>
      </div>

      {tab === 'export' ? (
        <section className="panel">
          <div className="panel-title"><div><h2>خروجی فهرست‌ها</h2><p>هر فایل با Excel (فارسی) سازگار است — ستون اول BOM یونیکد دارد</p></div></div>
          <div className="export-grid">
            {EXPORTS.map(spec => (
              <article className="export-card" key={spec.key}>
                <span className="stat-ico ic-blue" style={{ width: 36, height: 36, borderRadius: 10 }}>{spec.icon}</span>
                <div style={{ flex: 1 }}>
                  <b>{spec.label}</b>
                  <small>CSV · سازگار با Excel</small>
                </div>
                <button className="btn btn-secondary btn-sm" disabled={busy === spec.key} onClick={() => doExport(spec)}>
                  {busy === spec.key ? <RefreshCw size={13} className="spin" /> : <FileDown size={13}/>} دانلود
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-title">
              <div><h2>ورود گروهی اشخاص</h2><p>قالب CSV را دانلود، پر و بارگذاری کنید — پیش از ثبت، پیش‌نمایش و خطاها نمایش داده می‌شوند</p></div>
              <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}><FileDown size={13}/> دانلود قالب نمونه</button>
            </div>
            <div className="import-setup">
              <label className="field-label" htmlFor="imp-org">سازمان مقصد (محدودهٔ شما)</label>
              <select id="imp-org" value={targetOrg} onChange={e => setTargetOrg(e.target.value)} className="select-lg">
                <option value="">— انتخاب کنید —</option>
                {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <label className="file-drop">
                <Upload size={20}/>
                <span>{fileName || 'انتخاب فایل CSV…'}</span>
                <input type="file" accept=".csv,text/csv" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
            </div>
            {preview.length > 0 && (
              <div className="import-preview">
                <div className="panel-title"><div><h2>پیش‌نمایش ({preview.length} ردیف از {preview.length})</h2><p>۸ ردیف اول نمایش داده می‌شود</p></div></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>نام</th><th>نام خانوادگی</th><th>ایمیل</th><th>سمت</th><th>بخش</th></tr></thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td>{r.firstName}</td><td>{r.lastName}</td><td dir="ltr">{r.email || '—'}</td>
                          <td>{r.title || '—'}</td><td>{r.department || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importErrors.length > 0 && (
                  <div className="error-card" role="alert">
                    <b>{importErrors.length} هشدار در داده:</b>
                    <ul>{importErrors.slice(0, 10).map((er, i) => <li key={i}>{er}</li>)}</ul>
                  </div>
                )}
                <button className="btn btn-primary" disabled={busy === 'import' || !targetOrg} onClick={runImport}>
                  {busy === 'import' ? <RefreshCw size={14} className="spin"/> : <Upload size={14}/>}
                  ثبت {preview.length} شخص در «{orgOptions.find(o => o.id === targetOrg)?.name ?? ''}»
                </button>
                {!targetOrg && <p className="field-hint">برای ثبت، ابتدا سازمان مقصد را انتخاب کنید.</p>}
              </div>
            )}
            {result && (
              <div className={`success-card ${result.failed ? 'with-errors' : ''}`} role="status">
                <CheckCircle2 size={15}/> {fa(result.created)} شخص با موفقیت ثبت شد.
                {result.failed > 0 && <> <XCircle size={14}/> {fa(result.failed)} ناموفق: {result.errors.join('، ')}</>}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title"><div><h2>ستون‌های مجاز قالب</h2><p>ستون «سازمان» در قالب نمونه برای راهنمایی است و هنگام ورود نادیده گرفته می‌شود</p></div></div>
            <div className="help-list">
              <li><b>نام</b> و <b>نام خانوادگی</b> — الزامی</li>
              <li><b>ایمیل</b> — اختیاری، با اعتبارسنجی فرمت</li>
              <li><b>سمت / بخش</b> — اختیاری</li>
              <li>محدودیت: فقط اشخاص در سازمان‌های در محدودهٔ شما ثبت می‌شوند (بقیه ۴۰۳)</li>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function fa(n: number): string {
  const d = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/\d/g, x => d[Number(x)]);
}
