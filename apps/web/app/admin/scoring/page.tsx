'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../_lib/api';
import { useWorkspace } from '../../_components/workspace';
import {
  Badge, ErrorCard, Modal, PageHeader, StatCard, Toolbar,
} from '../../_components/page-ui';
import {
  Scale, RefreshCw, Search, Plus, X, CheckCircle2, Pencil, Power, Weight,
  Layers, HeartPulse, ShieldAlert, Target, UserCog, Sparkles, Activity, Eye, EyeOff, Rows3,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  قواعد امتیازدهی — موتور امتیازها (پاریتی با /admin/scoring-rules)  */
/* ------------------------------------------------------------------ */

type ScoringRule = {
  id: string; key: string; name: string;
  scoreType: string; entityType: string;
  weight: number; definition?: any;
  version: number; active: boolean;
  createdAt?: string | null;
};

const SCORE_TYPES = ['HEALTH', 'RISK', 'STRATEGIC', 'INFLUENCE', 'OPPORTUNITY', 'RESILIENCE'];
const SCORE_FA: Record<string, string> = {
  HEALTH: 'سلامت', RISK: 'ریسک', STRATEGIC: 'راهبردی', INFLUENCE: 'نفوذ', OPPORTUNITY: 'فرصت', RESILIENCE: 'تاب‌آوری',
};
const SCORE_ICON: Record<string, React.ReactNode> = {
  HEALTH: <HeartPulse size={13} />, RISK: <ShieldAlert size={13} />, STRATEGIC: <Target size={13} />,
  INFLUENCE: <UserCog size={13} />, OPPORTUNITY: <Sparkles size={13} />, RESILIENCE: <Activity size={13} />,
};
const SCORE_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  HEALTH: 'success', RISK: 'danger', STRATEGIC: 'info', INFLUENCE: 'warning', OPPORTUNITY: 'success', RESILIENCE: 'info',
};
const ENTITY_FA: Record<string, string> = {
  ORGANIZATION: 'سازمان', PERSON: 'شخص', RELATIONSHIP: 'رابطه', MEETING: 'جلسه',
  ACTION: 'اقدام', PROJECT: 'پروژه', OPPORTUNITY: 'فرصت',
};
const ENTITY_TYPES = Object.keys(ENTITY_FA);
const fmtNum = (v: number): string => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v);
const unwrap = (x: any): any[] => (Array.isArray(x) ? x : x?.items ?? x?.rows ?? x?.data ?? []);

function DefinitionSummary({ def }: { def?: any }) {
  if (def == null) return <span className="t-muted">—</span>;
  if (typeof def === 'string') return <span>{def}</span>;
  const inputs = Array.isArray(def.inputs) ? def.inputs : null;
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
      {inputs && inputs.length > 0 && (
        <span style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {inputs.slice(0, 3).map((x: any) => <span key={String(x)} className="chip" style={{ fontSize: 10.5, padding: '1px 7px' }}>{String(x)}</span>)}
          {inputs.length > 3 && <span className="t-muted" style={{ fontSize: 10.5 }}>+{fmtNum(inputs.length - 3)}</span>}
        </span>
      )}
      {typeof def.formula === 'string' && <span className="t-muted" style={{ fontSize: 11 }}>فرمول: {def.formula}</span>}
      {!inputs && typeof def.description === 'string' && <span style={{ fontSize: 11.5 }}>{def.description}</span>}
      {!inputs && !def.formula && !def.description && Object.keys(def).length > 0 && (
        <code dir="ltr" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{JSON.stringify(def).slice(0, 90)}</code>
      )}
    </span>
  );
}

export default function AdminScoringPage() {
  const { me } = useWorkspace();
  const isOwner = !!me?.permissions?.includes('*');

  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScoringRule | null>(null);
  const [form, setForm] = useState({ key: '', name: '', scoreType: 'HEALTH', entityType: 'RELATIONSHIP', weight: '1', definition: '', active: true });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true); setError('');
    try { setRules(unwrap(await api<ScoringRule[]>('/admin/scoring-rules'))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [isOwner]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter(r => r.active).length,
    inactive: rules.filter(r => !r.active).length,
    types: new Set(rules.map(r => r.scoreType)).size,
    avgWeight: rules.length ? rules.reduce((a, r) => a + (r.weight ?? 1), 0) / rules.length : 0,
  }), [rules]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rules.filter(r => {
      if (typeFilter && r.scoreType !== typeFilter) return false;
      if (entityFilter && r.entityType !== entityFilter) return false;
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'inactive' && r.active) return false;
      if (term && !`${r.name} ${r.key}`.toLowerCase().includes(term)) return false;
      return true;
    }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }, [rules, q, typeFilter, entityFilter, statusFilter]);

  function defToText(def?: any): string {
    if (def == null) return '';
    if (typeof def === 'string') return def;
    return JSON.stringify(def, null, 1);
  }
  const beginCreate = () => {
    setError(''); setFormError('');
    setEditing(null);
    setForm({ key: '', name: '', scoreType: 'HEALTH', entityType: 'RELATIONSHIP', weight: '1', definition: '{\n  "inputs": ["ورودی ۱", "ورودی ۲"],\n  "formula": "شرح ترکیب وزنی"\n}', active: true });
    setOpen(true);
  };
  const beginEdit = (r: ScoringRule) => {
    setError(''); setFormError('');
    setEditing(r);
    setForm({
      key: r.key, name: r.name, scoreType: r.scoreType, entityType: r.entityType,
      weight: String(r.weight ?? 1), definition: defToText(r.definition), active: r.active,
    });
    setOpen(true);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      let definition: unknown = form.definition.trim();
      if (!definition) { setFormError('تعریف قاعده لازم است.'); setSaving(false); return; }
      const saved = await api<ScoringRule>('/admin/scoring-rules', {
        method: 'POST',
        body: JSON.stringify({
          key: form.key.trim().toUpperCase(), name: form.name.trim(),
          scoreType: form.scoreType, entityType: form.entityType,
          weight: Number(form.weight) || 1, definition,
          ...(editing ? { version: (editing.version ?? 1) + 1 } : { version: 1 }),
          active: form.active,
        }),
      });
      setRules(list => {
        const rest = list.filter(r => r.id !== saved.id);
        return [...rest, saved].sort((a, b) => String(a.key).localeCompare(String(b.key)));
      });
      setOpen(false);
      setFlash(editing ? `قاعدهٔ «${saved.name}» به‌روزرسانی شد (نسخهٔ ${fmtNum(saved.version)}).` : `قاعدهٔ «${saved.name}» ساخته شد.`);
    } catch (x) { setFormError((x as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(r: ScoringRule) {
    if (busy) return;
    setBusy(r.id);
    try {
      const saved = await api<ScoringRule>('/admin/scoring-rules', {
        method: 'POST',
        body: JSON.stringify({
          key: r.key, name: r.name, scoreType: r.scoreType, entityType: r.entityType,
          weight: r.weight ?? 1, definition: r.definition, version: r.version, active: !r.active,
        }),
      });
      setRules(list => list.map(x => x.id === r.id ? saved : x));
      setFlash(saved.active ? `قاعدهٔ «${saved.name}» فعال شد.` : `قاعدهٔ «${saved.name}» غیرفعال شد.`);
    } catch (x) { setError((x as Error).message); }
    finally { setBusy(null); }
  }

  if (me && !isOwner && !loading) {
    return (
      <main className="feature-page">
        <PageHeader eyebrow="مدیریت / امتیازدهی" title="قواعد امتیازدهی" description="قواعد محاسبهٔ امتیازها." />
        <div className="empty-state-v4">
          <div className="empty-ico"><Scale size={26} /></div>
          <strong>این بخش فقط برای مالک سامانه است</strong>
          <p>برای مدیریت قواعد امتیازدهی به حساب مالک (مدیر کل سیستم) نیاز دارید.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-page">
      <PageHeader
        eyebrow="مدیریت / امتیازدهی"
        title="قواعد امتیازدهی"
        description="قواعد محاسبهٔ امتیازهای سلامت، ریسک، ارزش راهبردی، نفوذ، فرصت و تاب‌آوری به‌تفکیک نهاد — نسخه‌دار و قابل فعال/غیرفعال‌سازی."
        actions={
          <>
            <button className="btn btn-secondary" onClick={load} disabled={loading}><RefreshCw size={15} /> بازخوانی</button>
            <button className="btn btn-primary" onClick={beginCreate}><Plus size={16} /> قاعدهٔ جدید</button>
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
            <StatCard icon={<Scale size={18} />} label="کل قواعد" value={fmtNum(stats.total)} iconClass="ic-indigo" sub="در موتور امتیازدهی" />
            <StatCard icon={<CheckCircle2 size={18} />} label="فعال" value={fmtNum(stats.active)} iconClass="ic-teal" sub="در محاسبه اعمال می‌شوند" />
            <StatCard icon={<EyeOff size={18} />} label="غیرفعال" value={fmtNum(stats.inactive)} iconClass="ic-gold" sub="معلق شده‌اند" />
            <StatCard icon={<Layers size={18} />} label="انواع امتیاز" value={fmtNum(stats.types)} iconClass="ic-red" sub="سلامت/ریسک/راهبردی/…" />
            <StatCard icon={<Weight size={18} />} label="میانگین وزن" value={fmtNum(stats.avgWeight)} iconClass="ic-teal" sub="وزن قواعد فعال" />
          </div>

          <Toolbar search={q} onSearch={setQ} searchPlaceholder="جستجوی نام یا کلید قاعده…">
            <select aria-label="فیلتر نوع امتیاز" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ انواع امتیاز</option>
              {SCORE_TYPES.map(t => <option key={t} value={t}>{SCORE_FA[t]}</option>)}
            </select>
            <select aria-label="فیلتر نهاد" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ نهادها</option>
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_FA[t]}</option>)}
            </select>
            <select aria-label="فیلتر وضعیت" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="toolbar-select">
              <option value="">همهٔ وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
            <span className="chip info">{fmtNum(filtered.length)} قاعده</span>
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="empty-state-v4">
              <div className="empty-ico"><Search size={24} /></div>
              <strong>قاعده‌ای یافت نشد</strong>
              <p>{rules.length === 0 ? 'با «قاعدهٔ جدید» نخستین قاعده را بسازید.' : 'فیلترها یا عبارت جستجو را تغییر دهید.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>قاعده</th>
                    <th>نوع امتیاز</th>
                    <th>نهاد</th>
                    <th>وزن</th>
                    <th>تعریف</th>
                    <th>نسخه</th>
                    <th>وضعیت</th>
                    <th style={{ width: 110 }}>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className={r.active ? '' : 'row-muted'}>
                      <td>
                        <b className="t-primary">{r.name}</b>
                        <div className="t-muted"><code dir="ltr" style={{ fontSize: 10.5, fontFamily: 'ui-monospace,monospace' }}>{r.key}</code></div>
                      </td>
                      <td><Badge tone={SCORE_TONE[r.scoreType] ?? 'neutral'}>{SCORE_ICON[r.scoreType]}{SCORE_FA[r.scoreType] ?? r.scoreType}</Badge></td>
                      <td><Badge tone="info">{ENTITY_FA[r.entityType] ?? r.entityType}</Badge></td>
                      <td><span className="cell-count"><Weight size={12} /> {fmtNum(r.weight ?? 1)}</span></td>
                      <td style={{ maxWidth: 260 }}><DefinitionSummary def={r.definition} /></td>
                      <td><span className="chip">v{fmtNum(r.version ?? 1)}</span></td>
                      <td>{r.active ? <Badge tone="success"><Eye size={11} /> فعال</Badge> : <Badge tone="neutral"><EyeOff size={11} /> غیرفعال</Badge>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" title="ویرایش" onClick={() => beginEdit(r)} disabled={!!busy}><Pencil size={13} /></button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title={r.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                            onClick={() => toggleActive(r)} disabled={!!busy}
                            style={!r.active ? { color: 'var(--ok, #0a8f5c)' } : {}}
                          >
                            {busy === r.id ? <RefreshCw size={13} className="spin" /> : <Power size={13} />}
                          </button>
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

      {/* ------- create/edit ------- */}
      <Modal
        open={open}
        title={editing ? `ویرایش قاعدهٔ «${editing.name}»` : 'قاعدهٔ امتیازدهی جدید'}
        description={editing ? 'با هر ویرایش، نسخهٔ قاعده یک واحد افزایش می‌یابد (نسخه‌بندی موتور).' : 'تعریف قاعدهٔ محاسبهٔ یک نوع امتیاز برای یک نهاد.'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}><X size={14} /> انصراف</button>
            <button type="submit" form="sr-form" className="btn btn-primary" disabled={saving}>
              {saving ? <RefreshCw size={14} className="spin" /> : editing ? <Pencil size={14} /> : <Plus size={14} />}
              {editing ? ' ذخیرهٔ تغییرات' : ' ساخت قاعده'}
            </button>
          </>
        }
      >
        <ErrorCard message={formError} />
        <form id="sr-form" className="entity-form org-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">نام قاعده <i className="req">*</i></span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثلاً: سلامت رابطه" required />
            </label>
            <label className="field">
              <span className="field-label">کلید فنی <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left', fontFamily: 'ui-monospace, monospace' }}
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                placeholder="HEALTH_SCORE_V2" required minLength={3} maxLength={64}
              />
            </label>
            <label className="field">
              <span className="field-label">نوع امتیاز <i className="req">*</i></span>
              <select value={form.scoreType} onChange={e => setForm(f => ({ ...f, scoreType: e.target.value }))}>
                {SCORE_TYPES.map(t => <option key={t} value={t}>{SCORE_FA[t]}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">نهاد هدف <i className="req">*</i></span>
              <select value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_FA[t]}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">وزن <i className="req">*</i></span>
              <input
                dir="ltr" style={{ textAlign: 'left' }} type="number" step="0.1" min="0"
                value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} required
              />
            </label>
            <label className="field full">
              <span className="field-label">تعریف / فرمول <i className="req">*</i> <small className="t-muted">(JSON یا توضیح ساده)</small></span>
              <textarea
                dir="ltr" rows={6} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, textAlign: 'left' }}
                value={form.definition} onChange={e => setForm(f => ({ ...f, definition: e.target.value }))} required
              />
            </label>
            <label className="field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 'auto' }} />
              <span>قاعده فعال باشد (در محاسبات لحاظ شود)</span>
            </label>
          </div>
        </form>
      </Modal>
    </main>
  );
}
