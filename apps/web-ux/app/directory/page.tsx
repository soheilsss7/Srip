'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, StatCard } from '../_components/page-ui';
import { Database, Landmark, Link2, Search, ShieldCheck } from 'lucide-react';
import { localeTag, t } from '../_lib/i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   دیتابیس روابط بیرونی (مسترپلن فاز ۴/۲۵) — الگوی RelSci/TSC.ai
   «محصول دادهٔ جدا»: کاتالوگ فقط-خواندنیِ نهادهای عمومی (تنظیم‌گر/نهاد/
   دانشگاه/بازار سرمایه/اکوسیستم) با پایهٔ رکورد عمومی و متر مصرف جدا.
   اتصال نهاد = سازمانی در محدودهٔ همان مستأجر؛ مستأجرهای دیگر نه دیده
   می‌شوند نه قابل‌کشف‌اند. فقط رکورد سازمانی عمومی — بدون دادهٔ شخص خصوصی.
   ═══════════════════════════════════════════════════════════════════════════ */

type DirEntity = {
  id: string; name: string; type: string; industry: string | null;
  category: string; jurisdiction: string; dataBasis: string;
  source: { name: string; license: string };
  alreadyLinked: boolean; linkedOrgId?: string | null; linkedOrgName?: string | null;
  ties?: { directoryId: string; name: string; kind: string; basis: string }[];
};
type Usage = { queries: number; links: number; quota: number; remaining: number; plan: string; period?: string };
type SearchResp = { items: DirEntity[]; total: number; page: number; pageSize: number; usage: Usage; catalog: { entityCount: number; categories: string[] } };

const CATEGORY_LABEL: Record<string, string> = {
  REGULATOR: 'تنظیم‌گر', INSTITUTION: 'نهاد حاکمیتی', ACADEMIA: 'دانشگاه/پژوهش',
  CAPITAL_MARKET: 'بازار سرمایه', ECOSYSTEM: 'اکوسیستم نوآوری',
};
const CATEGORY_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  REGULATOR: 'warning', INSTITUTION: 'info', ACADEMIA: 'success', CAPITAL_MARKET: 'info', ECOSYSTEM: 'neutral',
};

export default function DirectoryPage() {
  const { can } = useWorkspace();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('ALL');
  const [resp, setResp] = useState<SearchResp | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [detail, setDetail] = useState<DirEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const canLink = can('organization.write');
  const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat(localeTag()).format(Number(v));

  const load = useCallback(async (search = q, cat = category) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ pageSize: '20' });
      if (search) params.set('search', search);
      if (cat && cat !== 'ALL') params.set('category', cat);
      const r = await apiGet<SearchResp>(`/directory/entities?${params.toString()}`);
      setResp(r); setUsage(r.usage ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [q, category]);

  useEffect(() => { load('', 'ALL'); /* بار اول: کاتالوگ کامل + متر مصرف */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id: string) => {
    setBusy(id); setError('');
    try { setDetail(await apiGet<DirEntity>(`/directory/entities/${id}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const linkEntity = async (id: string) => {
    setBusy(id); setError('');
    try {
      const r = await api<any>(`/directory/entities/${id}`, { method: 'POST' });
      setFlash(r?.message ?? t('نهاد متصل شد.'));
      setDetail(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const cats = resp?.catalog?.categories ?? Object.keys(CATEGORY_LABEL);

  return (
    <>
      <PageHeader
        title={t('دیتابیس روابط بیرونی')}
        description={t('کاتالوگ نهادهای عمومی با پایهٔ رکورد عمومی — جست‌وجو کنید و نهاد را به شبکهٔ روابط خودتان متصل کنید (محصول دادهٔ جدا با اشتراک و متر مصرف مستقل).')}
      />
      {flash && <p className="criteria-saved" role="status">{flash}</p>}
      {error && <ErrorCard message={error} />}

      {usage && (
        <div className="stat-grid">
          <StatCard icon={<Database size={18} />} label={t('نهادهای کاتالوگ')} value={fmtN(resp?.catalog?.entityCount)} iconClass="ic-teal" sub={t('رکورد عمومی سازمانی')} />
          <StatCard icon={<Search size={18} />} label={t('جست‌وجوی این ماه')} value={`${fmtN(usage.queries)}/${fmtN(usage.quota)}`} iconClass="ic-gold" sub={`${t('اشتراک')} directory-basic — ${fmtN(usage.remaining)} ${t('باقی‌مانده')}`} />
          <StatCard icon={<Link2 size={18} />} label={t('نهادهای متصل‌شده')} value={fmtN(usage.links)} iconClass="ic-teal" sub={t('در شبکهٔ شما')} />
          <StatCard icon={<ShieldCheck size={18} />} label={t('انطباق حریم خصوصی')} value={t('فقط رکورد عمومی')} iconClass="ic-teal" sub={t('بدون دادهٔ شخص خصوصی')} />
        </div>
      )}

      <section className="panel" aria-label={t('جست‌وجوی دیتابیس بیرونی')}>
        <div className="panel-title">
          <div>
            <h2 style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Landmark size={16} /> {t('نهادهای عمومی')}</h2>
            <p>{t('تنظیم‌گرها، نهادهای حاکمیتی، دانشگاه‌ها، بازیگران بازار سرمایه و اکوسیستم نوآوری — هر رکورد با منبع و مجوز استناد.')}</p>
          </div>
          {resp && <Badge tone="info">{fmtN(resp.total)} {t('نتیجه')}</Badge>}
        </div>
        <div className="toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <label className="field" style={{ margin: 0, flex: '1 1 220px' }}>
            <span className="field-label">{t('جست‌وجو')}</span>
            <input value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(q, category); }}
              placeholder={t('نام نهاد یا حوزهٔ فعالیت…')} />
          </label>
          <label className="field" style={{ margin: 0, minWidth: 170 }}>
            <span className="field-label">{t('دسته')}</span>
            <select value={category} onChange={e => { setCategory(e.target.value); load(q, e.target.value); }}>
              <option value="ALL">{t('همهٔ دسته‌ها')}</option>
              {cats.map(c => <option key={c} value={c}>{t(CATEGORY_LABEL[c] ?? c)}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" style={{ minHeight: 0, padding: '8px 14px' }} onClick={() => load(q, category)}>{t('جست‌وجو')}</button>
        </div>

        {loading ? <Loading /> : resp && (
          <div className="list">
            {resp.items.map(e => (
              <div className="listRow" key={e.id}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{e.name}</strong>
                  <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className={`chip ${CATEGORY_TONE[e.category] === 'warning' ? 'warning' : CATEGORY_TONE[e.category] === 'neutral' ? 'neutral' : CATEGORY_TONE[e.category] === 'success' ? 'success' : 'info'}`}>{t(CATEGORY_LABEL[e.category] ?? e.category)}</span>
                    {e.industry && <span className="chip neutral">{e.industry}</span>}
                    <span className="chip neutral" title={e.source.name}>{t('رکورد عمومی')}</span>
                  </span>
                </span>
                {e.alreadyLinked ? (
                  <Link className="chip success" href="/organizations">{t('متصل‌شده به شبکهٔ شما')}</Link>
                ) : (
                  <button className="btn btn-ghost btn-sm" disabled={!canLink || busy === e.id} onClick={() => openDetail(e.id)}>
                    {busy === e.id ? t('…') : t('اتصال به شبکهٔ من')}
                  </button>
                )}
              </div>
            ))}
            {!resp.items.length && <p className="criteria-saved">{t('نتیجه‌ای یافت نشد — عبارت دیگری بیازمایید.')}</p>}
          </div>
        )}
      </section>

      {detail && (
        <div className="notice" role="dialog" aria-label={t('جزئیات نهاد')} style={{ border: '1px solid var(--border,#e2e8f0)' }}>
          <b>{detail.name}</b>
          <p style={{ marginTop: 6, marginBottom: 6 }}>
            {t('دسته')}: {t(CATEGORY_LABEL[detail.category] ?? detail.category)} · {t('حوزه')}: {detail.industry ?? '—'} · {t('منبع')}: {detail.source.name}
          </p>
          {detail.ties && detail.ties.length > 0 && (
            <>
              <b style={{ fontSize: 12.5 }}>{t('پیوندهای شناخته‌شدهٔ عمومی')}</b>
              <div className="list" style={{ marginTop: 6 }}>
                {detail.ties.map(tie => (
                  <div className="listRow" key={tie.directoryId}>
                    <span style={{ flex: 1, minWidth: 0 }}>{tie.name}</span>
                    <span className="chip neutral" title={tie.basis}>{tie.kind === 'STRUCTURAL' ? t('پیوند ساختاری') : t('هم‌حوزهٔ فعالیت')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p style={{ fontSize: 11.5, marginTop: 8 }}>{t('با اتصال، یک سازمان در محدودهٔ سازمانی شما ساخته می‌شود؛ دادهٔ مستأجرهای دیگر هرگز نمایش داده نمی‌شود.')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!canLink || busy === detail.id} onClick={() => linkEntity(detail.id)}>
              {busy === detail.id ? t('در حال اتصال…') : t('اتصال به شبکهٔ من')}
            </button>
            <button className="btn btn-ghost" onClick={() => setDetail(null)}>{t('انصراف')}</button>
          </div>
        </div>
      )}
    </>
  );
}
