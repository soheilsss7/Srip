'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  Database, RefreshCw, Search, Plus, X, CheckCircle2, Layers, BookMarked,
  Pencil, Trash2, Lock, Globe2, Factory, Building2, GitBranch, Save,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  داده‌های مبنایی — کاتالوگ مقادیر مرجع با کاربرد واقعی               */
/*  بک‌اند: GET/POST/PATCH/DELETE /admin/master-data                   */
/* ------------------------------------------------------------------ */

type Category = { key: string; label: string; locked: boolean; editable: boolean };
type MdItem = { value: string; usage: number };
type MasterResponse = { categories: Category[]; industry: MdItem[]; country: MdItem[]; orgType: MdItem[]; relType: MdItem[] };

const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);

const CAT_ICON: Record<string, React.ReactNode> = {
  industry: <Factory size={15} />, country: <Globe2 size={15} />,
  orgType: <Building2 size={15} />, relType: <GitBranch size={15} />,
};
const ORG_TYPE_FA: Record<string, string> = {
  HOLDING: 'هلدینگ', SUBSIDIARY: 'زیرمجموعه', CUSTOMER: 'مشتری', PARTNER: 'شریک',
  BANK: 'بانک', GOVERNMENT: 'دولتی', INVESTOR: 'سرمایه‌گذار', SUPPLIER: 'تأمین‌کننده', OTHER: 'سایر',
};
const REL_TYPE_FA_EXT: Record<string, string> = {
  STRATEGIC_PARTNERSHIP: 'مشارکت راهبردی', BANKING: 'بانکی', CUSTOMER: 'مشتری',
  SUPPLY: 'تأمین', INVESTMENT: 'سرمایه‌گذاری', PARTNERSHIP: 'مشارکت', SUPPLIER: 'تأمین‌کننده',
  INVESTOR: 'سرمایه‌گذار', OTHER: 'سایر',
};
const valueLabel = (cat: string, v: string) =>
  cat === 'orgType' ? (ORG_TYPE_FA[v] ?? v) : cat === 'relType' ? (REL_TYPE_FA_EXT[v] ?? v) : v;

export default function AdminMasterDataPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [data, setData] = useState<MasterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [activeCat, setActiveCat] = useState('industry');
  const [q, setQ] = useState('');
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [addValue, setAddValue] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setData(await api<MasterResponse>('/admin/master-data')); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const activeDef = data?.categories.find(c => c.key === activeCat);
  const items: MdItem[] = (data?.[activeCat as keyof MasterResponse] as MdItem[] | undefined) ?? [];
  const catUsageTotal = items.reduce((a, x) => a + x.usage, 0);
  const usedCount = items.filter(x => x.usage > 0).length;
  const freeCount = items.length - usedCount;

  const stats = useMemo(() => {
    const all = data ? [
      ...data.industry.map(x => ({ ...x, c: 'industry' })),
      ...data.country.map(x => ({ ...x, c: 'country' })),
    ] : [];
    const allUsed = all.reduce((a, x) => a + (x.usage > 0 ? 1 : 0), 0);
    const locked = (data?.categories ?? []).filter(c => c.locked).length;
    return { freeVals: all.length, freeUsed: allUsed, locked };
  }, [data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter(x => {
      if (onlyUsed && x.usage === 0) return false;
      if (term && !valueLabel(activeCat, x.value).toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => (b.usage - a.usage) || a.value.localeCompare(b.value, 'fa'));
  }, [items, q, onlyUsed, activeCat]);

  async function add() {
    if (!addValue.trim()) { setFormError('نام مقدار را بنویسید.'); return; }
    setSaving(true); setFormError('');
    try {
      await api<MdItem>('/admin/master-data', { method: 'POST', body: JSON.stringify({ category: activeCat, value: addValue.trim() }) });
      setOpen(false); setAddValue('');
      setFlash(`مقدار «${addValue.trim()}» به کاتالوگ ${activeDef?.label} افزوده شد.`);
      await load();
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function rename() {
    if (!renaming || !renameVal.trim()) { setRenaming(null); return; }
    setBusyKey(`r:${renaming}`); setError('');
    try {
      await api('/admin/master-data', {
        method: 'PATCH',
        body: JSON.stringify({ category: activeCat, value: renaming, newValue: renameVal.trim() }),
      });
      setFlash(`«${renaming}» به «${renameVal.trim()}» تغییر نام داد و در رکوردها اعمال شد.`);
      setRenaming(null); setRenameVal('');
      await load();
    } catch (x) { setError((x as Error).message); setRenaming(null); }
    finally { setBusyKey(null); }
  }

  async function remove(value: string) {
    if (busyKey) return;
    setBusyKey(`d:${value}`); setError('');
    try {
      await api('/admin/master-data', { method: 'DELETE', body: JSON.stringify({ category: activeCat, value }) });
      setFlash(`مقدار «${value}» از کاتالوگ حذف شد.`);
      await load();
    } catch (x) { setError((x as Error).message); }
    finally { setBusyKey(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / داده‌های مبنایی" title="داده‌های مبنایی" description="کاتالوگ مقادیر مرجع سیستم." />
        <div className="empty-state-v4">
          <div className="empty-ico"><BookMarked size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت داده‌های مبنایی به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / داده‌های مبنایی"
        title="داده‌های مبنایی"
        description="مقادیر مرجع فرم‌ها و فیلترها — صنایع و کشورها آزادند (افزودن/تغییر نام/حذف بی‌استفاده) و انواع سازمان/رابطه ثابت (enum). کاربرد هر مقدار از دادهٔ واقعی شمارش می‌شود."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            {activeDef && activeDef.editable && (
              <button className="btn btn-primary" onClick={() => { setFormError(''); setAddValue(''); setOpen(true); }}><Plus size={16} /> افزودن به {activeDef.label}</button>
            )}
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 300 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Layers size={18} />} label="دسته‌های مبنایی" value={fmtNum(4)} iconClass="ic-indigo" sub="صنعت · کشور · نوع سازمان · نوع رابطه" />
            <StatCard icon={<BookMarked size={18} />} label="مقادیر آزاد کاتالوگ" value={fmtNum(stats.freeVals)} iconClass="ic-teal" sub="صنایع + کشورها" />
            <StatCard icon={<Database size={18} />} label="در حال استفاده" value={fmtNum(stats.freeUsed)} iconClass="ic-gold" sub="داری رکورد واقعی" />
            <StatCard icon={<Lock size={18} />} label="دسته‌های قفل" value={fmtNum(stats.locked)} iconClass="ic-red" sub="enum های سیستم" />
            <StatCard icon={<GitBranch size={18} />} label="کاربرد کل فعال" value={fmtNum(catUsageTotal)} iconClass="ic-teal" sub={`در دستهٔ «${activeDef?.label ?? ''}»`} />
          </div>

          {/* category tabs */}
          <div className="md-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {(data?.categories ?? []).map(c => (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={activeCat === c.key ? 'tab-chip tab-chip-active' : 'tab-chip'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {CAT_ICON[c.key]}
                {c.label}
                {c.locked && <Lock size={11} />}
                <span className="chip" style={{ fontSize: 10.5 }}>{fmtNum((data?.[c.key as keyof MasterResponse] as MdItem[] | undefined)?.length ?? 0)}</span>
              </button>
            ))}
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder={`جستجو در ${activeDef?.label ?? ''}…`}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }} className="t-muted">
              <input type="checkbox" checked={onlyUsed} onChange={e => setOnlyUsed(e.target.checked)} style={{ width: 'auto' }} />
              فقط در حال استفاده
            </label>
            {activeDef?.editable && (
              <span className="chip info" title="دستهٔ آزاد">{activeDef.locked ? '' : 'آزاد برای ویرایش'} · {fmtNum(usedCount)} استفاده‌شده · {fmtNum(freeCount)} بی‌استفاده</span>
            )}
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>مقداری یافت نشد</strong>
              <p>جستجو یا فیلتر را تغییر دهید.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>مقدار</th>
                    <th>کاربرد</th>
                    <th>وضعیت</th>
                    <th style={{ width: 170 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={`${activeCat}:${item.value}`}>
                      <td>
                        {renaming === item.value ? (
                          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', width: '100%' }}>
                            <input
                              autoFocus value={renameVal}
                              onChange={e => setRenameVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(null); }}
                              style={{ maxWidth: 260 }}
                            />
                            <button className="btn btn-primary btn-sm" onClick={rename} disabled={!!busyKey}><Save size={12} /> ذخیره</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(null)}><X size={12} /></button>
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {CAT_ICON[activeCat]}
                            <b className="t-primary" style={{ fontSize: 12.5 }}>
                              {activeCat === 'industry' || activeCat === 'country' ? item.value : valueLabel(activeCat, item.value)}
                            </b>
                            {activeCat !== 'industry' && activeCat !== 'country' && (
                              <code dir="ltr" style={{ fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'ui-monospace,monospace' }}>{item.value}</code>
                            )}
                          </span>
                        )}
                      </td>
                      <td><span className="cell-count"><Database size={12} /> {fmtNum(item.usage)} رکورد</span></td>
                      <td>
                        {item.usage > 0 ? <Badge tone="success">در حال استفاده</Badge> : <Badge tone="neutral">بی‌استفاده</Badge>}
                        {activeDef?.locked && <span style={{ marginInlineStart: 6 }}><Badge tone="warning"><Lock size={10} /> ثابت</Badge></span>}
                      </td>
                      <td>
                        {activeDef?.editable && (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="تغییر نام (در رکوردها هم اعمال می‌شود)"
                              onClick={() => { setRenaming(item.value); setRenameVal(item.value); setError(''); }}
                              disabled={!!busyKey}
                            ><Pencil size={13} /> تغییر نام</button>
                            <button
                              className="btn btn-ghost btn-sm danger-ghost"
                              title={item.usage > 0 ? 'این مقدار در رکوردها استفاده شده و قابل حذف نیست' : 'حذف از کاتالوگ'}
                              onClick={() => remove(item.value)}
                              disabled={!!busyKey || item.usage > 0}
                            ><Trash2 size={13} /></button>
                          </span>
                        )}
                        {!activeDef?.editable && <span className="t-muted" style={{ fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* add modal */}
      <Modal
        open={open}
        title={`افزودن به کاتالوگ «${activeDef?.label ?? ''}»`}
        description="مقدار جدید در کاتالوگ مرجع ثبت می‌شود و از این پس در فیلترها و فرم‌ها در دسترس است."
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="button" className="btn btn-primary" onClick={add} disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />} افزودن
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <div className="entity-form org-form">
          <label className="field">
            <span className="field-label">نام مقدار <i className="req">*</i></span>
            <input
              value={addValue} autoFocus
              onChange={e => setAddValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add(); }}
              placeholder={activeCat === 'industry' ? 'مثال: معدن' : 'مثال: سوئد'}
            />
            <small className="t-muted">نام تکراری پذیرفته نمی‌شود.</small>
          </label>
        </div>
      </Modal>
    </main>
  );
}
