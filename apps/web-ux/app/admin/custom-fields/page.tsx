'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  ListPlus, RefreshCw, Search, Plus, X, CheckCircle2, Pencil, Trash2, Power,
  Rows3, Type, Hash, CheckSquare, CalendarDays, ToggleRight, CircleDot, ChevronsUpDown,
  Mail, Link2, Eye, EyeOff,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  فیلدهای سفارشی — تعریف فیلدهای تکمیلی برای نهادها                  */
/*  بک‌اند: GET/POST /custom-fields · DELETE /custom-fields/:id       */
/* ------------------------------------------------------------------ */

type CustomField = {
  id: string; key: string; label: string;
  entityType: string; fieldType: string;
  options?: string[] | null;
  required: boolean; active: boolean;
  createdAt?: string | null; updatedAt?: string | null;
  valueCount?: number;
};

const ENTITY_TYPES = ['Organization', 'Person', 'Relationship', 'Interaction', 'Meeting', 'Action', 'Commitment', 'Project', 'Requirement', 'Opportunity', 'Recommendation', 'Document', 'Note', 'Workflow', 'Referral', 'ConnectionPath', 'OrganizationUnit'];
const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'email', 'url'];
const ENTITY_FA: Record<string, string> = {
  Organization: 'سازمان', Person: 'شخص', Relationship: 'رابطه', Interaction: 'تعامل', Meeting: 'جلسه',
  Action: 'اقدام', Commitment: 'تعهد', Project: 'پروژه', Requirement: 'نیازمندی', Opportunity: 'فرصت',
  Recommendation: 'پیشنهاد', Document: 'سند', Note: 'یادداشت', Workflow: 'گردش کار', Referral: 'معرفی',
  ConnectionPath: 'مسیر ارتباط', OrganizationUnit: 'واحد سازمانی',
};
const FIELD_FA: Record<string, string> = {
  text: 'متن', number: 'عدد', boolean: 'بلی/خیر', date: 'تاریخ', datetime: 'تاریخ و زمان',
  select: 'انتخاب تکی', multiselect: 'انتخاب چندگانه', email: 'ایمیل', url: 'پیوند',
};
const FIELD_ICON: Record<string, React.ReactNode> = {
  text: <Type size={13} />, number: <Hash size={13} />, boolean: <ToggleRight size={13} />,
  date: <CalendarDays size={13} />, datetime: <CalendarDays size={13} />,
  select: <CircleDot size={13} />, multiselect: <ChevronsUpDown size={13} />,
  email: <Mail size={13} />, url: <Link2 size={13} />,
};
const ENTITY_TONE: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  Organization: 'info', Person: 'success', Relationship: 'purple' as any, Interaction: 'warning',
  Meeting: 'neutral', Action: 'info', Commitment: 'warning', Project: 'success',
};
const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR').format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

export default function AdminCustomFieldsPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [form, setForm] = useState<CustomField>({
    id: '', key: '', label: '', entityType: 'Organization', fieldType: 'text',
    options: [], required: false, active: true,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setFields(unwrap(await api<CustomField[]>('/custom-fields'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: fields.length,
    active: fields.filter(f => f.active).length,
    inactive: fields.filter(f => !f.active).length,
    values: fields.reduce((a, f) => a + (f.valueCount ?? 0), 0),
    entities: new Set(fields.map(f => f.entityType)).size,
  }), [fields]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return fields.filter(f => {
      if (entityFilter && f.entityType !== entityFilter) return false;
      if (typeFilter && f.fieldType !== typeFilter) return false;
      if (statusFilter === 'active' && !f.active) return false;
      if (statusFilter === 'inactive' && f.active) return false;
      if (statusFilter === 'valued' && !(f.valueCount ?? 0)) return false;
      if (term && !`${f.label} ${f.key}`.toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => String(a.entityType).localeCompare(String(b.entityType)) || a.key.localeCompare(b.key));
  }, [fields, q, entityFilter, typeFilter, statusFilter]);

  const beginCreate = () => {
    setError(''); setFormError('');
    setEditing(null);
    setForm({ id: '', key: '', label: '', entityType: 'Organization', fieldType: 'text', options: [], required: false, active: true });
    setModalOpen(true);
  };
  const beginEdit = (f: CustomField) => {
    setError(''); setFormError('');
    setEditing(f);
    setForm({ ...f, options: Array.isArray(f.options) ? f.options : [] });
    setModalOpen(true);
  };

  const needsOptions = form.fieldType === 'select' || form.fieldType === 'multiselect';
  const keyNormalized = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      const payload: Record<string, unknown> = {
        key: keyNormalized(form.key) || form.key,
        label: form.label, entityType: form.entityType, fieldType: form.fieldType,
        required: form.required,
        ...(needsOptions ? { options: (form.options ?? []).map(String).map(s => s.trim()).filter(Boolean) } : {}),
      };
      const saved = await api<CustomField>('/custom-fields', { method: 'POST', body: JSON.stringify(payload) });
      setFields(list => {
        const rest = list.filter(f => f.id !== saved.id);
        return [...rest, saved];
      });
      setModalOpen(false);
      setFlash(editing ? `فیلد «${saved.label}» به‌روزرسانی شد.` : `فیلد سفارشی «${saved.label}» ساخته شد.`);
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(f: CustomField) {
    if (busy) return;
    setBusy(f.id);
    try {
      // PATCH is not exposed by the real controller; upsert via POST (definition-level parity).
      const saved = await api<CustomField>('/custom-fields', {
        method: 'POST',
        body: JSON.stringify({
          key: f.key, label: f.label, entityType: f.entityType, fieldType: f.fieldType,
          required: f.required, active: !f.active,
          ...((f.fieldType === 'select' || f.fieldType === 'multiselect') ? { options: f.options ?? [] } : {}),
        }),
      });
      setFields(list => list.map(x => x.id === f.id ? saved : x));
      setFlash(saved.active ? `فیلد «${saved.label}» فعال شد.` : `فیلد «${saved.label}» غیرفعال شد؛ مقدارها حفظ می‌شوند.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  async function remove(f: CustomField) {
    if (!confirm(`فیلد «${f.label}» حذف شود؟\n${(f.valueCount ?? 0) > 0 ? `این فیلد ${fmtNum(f.valueCount!)} مقدار دارد — حذف ممکن نیست؛ آن را غیرفعال کنید.` : ''}`)) return;
    setBusy(f.id);
    try {
      await api(`/custom-fields/${encodeURIComponent(f.id)}`, { method: 'DELETE' });
      setFields(list => list.filter(x => x.id !== f.id));
      setFlash(`فیلد «${f.label}» حذف شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / فیلدهای سفارشی" title="فیلدهای سفارشی" description="تعریف فیلدهای تکمیلی برای نهادها." />
        <div className="empty-state-v4">
          <div className="empty-ico"><ListPlus size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت فیلدهای سفارشی به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / فیلدهای سفارشی"
        title="فیلدهای سفارشی"
        description="تعریف فیلدهای تکمیلی برای سازمان، شخص، رابطه، جلسه و… — با نوع، گزینه‌ها و الزامی‌بودن؛ مقدارها در پروفایل هر نهاد نمایش داده می‌شوند."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={beginCreate}><Plus size={16} /> فیلد جدید</button>
          </>
        }
      />
      <ErrorCard message={error} />
      {flash && <div className="flash-banner" role="status"><CheckCircle2 size={15} /> {flash}</div>}

      {loading ? (
        <>
          <div className="stat-grid">{[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 104 }} />)}</div>
          <div className="skeleton skeleton-table" style={{ height: 380 }} />
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={<Rows3 size={18} />} label="کل فیلدها" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="تعریف‌شده" />
            <StatCard icon={<CheckCircle2 size={18} />} label="فعال" value={fmtNum(stats.active)} iconClass="ic-teal" sub="در فرم‌ها نمایش داده می‌شوند" />
            <StatCard icon={<EyeOff size={18} />} label="غیرفعال" value={fmtNum(stats.inactive)} iconClass="ic-gold" sub="پنهان؛ مقدارها محفوظ" />
            <StatCard icon={<ListPlus size={18} />} label="مقدار ثبت‌شده" value={fmtNum(stats.values)} iconClass="ic-red" sub="روی نهادها" />
            <StatCard icon={<Rows3 size={18} />} label="نهادهای هدف" value={fmtNum(stats.entities)} iconClass="ic-teal" sub="نوع نهاد دارای تعریف" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام یا کلید فیلد…">
            <select aria-label="فیلتر نهاد" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نهادها</option>
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_FA[t]}</option>)}
            </select>
            <select aria-label="فیلتر نوع" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ انواع</option>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_FA[t]}</option>)}
            </select>
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
              <option value="valued">دارای مقدار</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} فیلد</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>فیلدی یافت نشد</strong>
              <p>{fields.length === 0 ? 'با «فیلد جدید» نخستین تعریف را بسازید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>فیلد</th>
                    <th>نهاد</th>
                    <th>نوع</th>
                    <th>گزینه‌ها</th>
                    <th>الزامی</th>
                    <th>مقدارها</th>
                    <th>وضعیت</th>
                    <th style={{ width: 120 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} className={f.active ? '' : 'row-muted'}>
                      <td>
                        <b className="t-primary">{f.label}</b>
                        <div className="t-muted"><code dir="ltr" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{f.key}</code></div>
                      </td>
                      <td><Badge tone={(ENTITY_TONE[f.entityType] as any) ?? 'neutral'}>{ENTITY_FA[f.entityType] ?? f.entityType}</Badge></td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {FIELD_ICON[f.fieldType]}{FIELD_FA[f.fieldType] ?? f.fieldType}
                        </span>
                      </td>
                      <td>
                        {Array.isArray(f.options) && f.options.length > 0 ? (
                          <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {f.options.slice(0, 3).map(o => <span key={o} className="chip" style={{ fontSize: 10.5, padding: '1px 6px' }}>{o}</span>)}
                            {f.options.length > 3 && <span className="t-muted" style={{ fontSize: 10.5 }}>+{fmtNum(f.options.length - 3)}</span>}
                          </span>
                        ) : <span className="t-muted">—</span>}
                      </td>
                      <td>{f.required ? <Badge tone="danger"><i className="req">*</i> الزامی</Badge> : <Badge tone="neutral">اختیاری</Badge>}</td>
                      <td><span className="cell-count"><ListPlus size={12} /> {fmtNum(f.valueCount ?? 0)}</span></td>
                      <td>{f.active ? <Badge tone="success"><Eye size={11} /> فعال</Badge> : <Badge tone="neutral"><EyeOff size={11} /> غیرفعال</Badge>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" title="ویرایش" onClick={() => beginEdit(f)} disabled={!!busy}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-sm" title={f.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'} onClick={() => toggleActive(f)} disabled={!!busy}>
                            {busy === f.id ? <RefreshCw size={13} className="spin" /> : f.active ? <Power size={13} /> : <Power size={13} />}
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger, #c0392b)' }} title="حذف" onClick={() => remove(f)} disabled={!!busy}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------- create/edit modal ------- */}
      <Modal
        open={modalOpen}
        title={editing ? `ویرایش فیلد «${editing.label}»` : 'فیلد سفارشی جدید'}
        description={editing ? 'تغییر برچسب/نوع/گزینه‌ها/الزامی‌بودن (تغییر نوع پس از ثبت مقدار مسدود است).' : 'تعریف فیلد تکمیلی؛ پس از ساخت، مقدارها از پروفایل هر نهاد قابل ثبت است.'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="cf-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : editing ? <Pencil size={14} /> : <Plus size={14} />}
              {editing ? ' ذخیرهٔ تغییرات' : ' ساخت فیلد'}
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="cf-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">کلید فنی <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace' }}
                value={form.key} onChange={e => setForm(f => ({ ...f, key: keyNormalized(e.target.value) }))}
                placeholder="tax_number" required maxLength={100}
              />
              <small className="t-muted">لاتین کوچک؛ برای شناسایی داخلی — پس از ساخت بهتر است ثابت بماند.</small>
            </label>
            <label className="field">
              <span className="field-label">برچسب نمایشی <i className="req">*</i></span>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="مثلاً: کد اقتصادی" required />
            </label>
            <label className="field">
              <span className="field-label">نوع نهاد <i className="req">*</i></span>
              <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_FA[t]}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">نوع فیلد <i className="req">*</i></span>
              <select value={form.fieldType} onChange={e => setForm(f => ({ ...f, fieldType: e.target.value }))}>
                {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_FA[t]}</option>)}
              </select>
            </label>
            {needsOptions && (
              <label className="field full">
                <span className="field-label">گزینه‌ها <i className="req">*</i> <small className="t-muted">(هر گزینه در یک خط)</small></span>
                <textarea
                  rows={4}
                  dir="rtl"
                  value={(form.options ?? []).join('\n')}
                  onChange={e => setForm(f => ({ ...f, options: e.target.value.split('\n') }))}
                  placeholder={'کم\nمتوسط\nزیاد'}
                  required={needsOptions}
                />
              </label>
            )}
            <label className="field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} style={{ width: 'auto' }} />
              <span>فیلد الزامی باشد (در فرم نهاد حتماً باید مقدار بگیرد)</span>
            </label>
          </div>
        </form>
      </Modal>
    </main>
  );
}
