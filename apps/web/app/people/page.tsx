'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Card, Badge } from '@srip/design-system';
import {
  Users, Building2, Search, Plus, Mail, Crown, Handshake, PersonStanding, Phone, ChevronLeft, Star,
} from 'lucide-react';

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  country?: string;
  status?: string;
  influenceScore?: number;
  decisionPower?: number;
  accessibilityScore?: number;
  organizationId: string;
  organization?: { id: string; name: string; type: string };
};
type Org = { id: string; name: string; type: string };

const STATUS_PILL: Record<string, string> = {
  ACTIVE: 'success', INACTIVE: 'neutral', 'ON_LEAVE': 'warning', DORMANT: 'neutral', ARCHIVED: 'danger',
};

function ScorePill({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | undefined; tone: string }) {
  return (
    <span className="person-score" title={`${label}: ${value ?? '—'}`}>
      {icon}<b className={tone}>{value ?? '—'}</b>
    </span>
  );
}

export default function PeoplePage() {
  const { scopeId, can } = useWorkspace();
  const scopeQuery = useCallback((extra = true) => {
    const qs: string[] = [];
    if (scopeId !== 'all') qs.push(`organizationId=${encodeURIComponent(scopeId)}`);
    return qs.length ? `?${qs.join('&')}` : '';
  }, [scopeId]);

  const [items, setItems] = useState<Person[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [org, setOrg] = useState('');

  const writable = can('person.write');

  const load = useCallback(async () => {
    try {
      setError('');
      if (!items.length) setLoading(true);
      const params = new URLSearchParams();
      if (appliedQ) params.set('q', appliedQ);
      if (scopeId !== 'all') params.set('organizationId', scopeId);
      const qs = params.toString();
      const data = await api<{ data: Person[]; total?: number }>(`/people${qs ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data as Person[] : data.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [appliedQ, scopeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (writable) api<{ data: Org[] }>('/organizations').then(d => setOrgs(Array.isArray(d) ? d as Org[] : d.data ?? [])).catch(() => {}); }, [writable]);

  const applySearch = () => { setAppliedQ(q.trim()); };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writable) return;
    setSaving(true); setError('');
    try {
      await api('/people', { method: 'POST', body: JSON.stringify({ firstName: first, lastName: last, email: email || undefined, phone: phone || undefined, title: title || undefined, department: department || undefined, organizationId: org }) });
      setFirst(''); setLast(''); setEmail(''); setPhone(''); setTitle(''); setDepartment(''); setOrg('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const total = items.length;
  const activeCount = items.filter(p => (p.status ?? 'ACTIVE') === 'ACTIVE').length;
  const highInfluence = items.filter(p => (p.influenceScore ?? 0) >= 80).length;

  const sorted = useMemo(() => [...items]
    .filter((p) => !statusFilter || (p.status ?? 'ACTIVE') === statusFilter)
    .sort((a, b) => {
      const ia = (a.influenceScore ?? 0) + (a.decisionPower ?? 0);
      const ib = (b.influenceScore ?? 0) + (b.decisionPower ?? 0);
      return ib - ia;
    }), [items, statusFilter]);

  return (
    <div className="people-page">
      {/* Header */}
      <section className="page-heading">
        <div>
          <div className="eyebrow">SRIP Workspace · Core Directory</div>
          <h1>اشخاص</h1>
          <p className="subtitle">فهرست اشخاص متصل به مالکیت سازمانی، امتیاز نفوذ، قدرت تصمیم و دسترس‌پذیری — همه از Backend واقعی با محدودهٔ سازمانی.</p>
        </div>
        <div className="heading-tools">
          <span className="scope-chip"><Building2 size={13}/> {scopeId === 'all' ? 'همه محدوده' : scopeId.slice(0, 10)}</span>
          <Link className="primary-action" href="#add-person"><Plus size={14}/> افزودن شخص</Link>
        </div>
      </section>

      {error && <div className="error-card" role="alert">{error}</div>}

      {/* Stats */}
      <section className="stats-row" aria-label="People metrics">
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-purple"><Users size={18}/></span><span className="st-name">کل اشخاص</span></div>
          <strong className="st-value">{total}</strong>
          <div className="st-foot"><span className="st-delta up">در محدودهٔ فعلی</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-teal"><Handshake size={18}/></span><span className="st-name">فعال</span></div>
          <strong className="st-value">{activeCount}</strong>
          <div className="st-foot"><span className="st-delta">{total ? Math.round((activeCount / total) * 100) : 0}%</span><span className="st-note">از کل</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-gold"><Crown size={18}/></span><span className="st-name">نفوذ بالا</span></div>
          <strong className="st-value">{highInfluence}</strong>
          <div className="st-foot"><span className="st-delta">influence ≥ 80</span></div>
        </div>
        <div className="stat-card">
          <div className="st-top"><span className="st-ico ic-blue"><Building2 size={18}/></span><span className="st-name">سازمان‌ها</span></div>
          <strong className="st-value">{orgs.length}</strong>
          <div className="st-foot"><span className="st-delta">مقصد انتساب</span></div>
        </div>
      </section>

      {/* Filters + Create */}
      <section className="split-panels">
        {/* Directory table */}
        <Card className="people-directory">
          <div className="panel-title">
            <div><h2>Directory</h2><p>مرتب‌شده بر اساس نفوذ + قدرت تصمیم</p></div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={15}/>
                <input
                  placeholder="جستجوی نام، ایمیل یا سمت…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
                />
                <button className="srip-button ghost" onClick={applySearch}>یافتن</button>
              </div>
              <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">همه وضعیت‌ها</option>
                {Object.keys(STATUS_PILL).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-row"><span className="spinner" /> در حال بارگذاری…</div>
          ) : sorted.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>شخص</th>
                    <th>سازمان / سمت</th>
                    <th>تماس</th>
                    <th>امتیاز (نفوذ / تصمیم / دسترس)</th>
                    <th>وضعیت</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="person-cell">
                            <span className="avatar">{initials || '?'}</span>
                            <div>
                              <strong>{p.firstName} {p.lastName}</strong>
                              <small>{p.department ? `${p.department} · ${p.country ?? ''}`.replace(/ · $/, '') : (p.country || '—')}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="org-cell">
                            <strong>{p.organization?.name ?? '—'}</strong>
                            <small>{p.title || 'بدون سمت'}{p.organization?.type ? ` · ${p.organization.type}` : ''}</small>
                          </div>
                        </td>
                        <td>
                          <div className="contact-cell">
                            {p.email ? <span><Mail size={12}/>{p.email}</span> : null}
                            {p.phone ? <span><Phone size={12}/>{p.phone}</span> : null}
                            {!p.email && !p.phone ? <span className="muted">—</span> : null}
                          </div>
                        </td>
                        <td>
                          <div className="person-scores">
                            <ScorePill icon={<Star size={12}/>} label="نفوذ" tone={scoreTone(p.influenceScore)} value={p.influenceScore ?? 0} />
                            <ScorePill icon={<Crown size={12}/>} label="قدرت تصمیم" tone={scoreTone(p.decisionPower)} value={p.decisionPower ?? 0} />
                            <ScorePill icon={<PersonStanding size={12}/>} label="دسترس‌پذیری" tone={scoreTone(p.accessibilityScore)} value={p.accessibilityScore ?? 0} />
                          </div>
                        </td>
                        <td><Badge className={STATUS_PILL[p.status ?? 'ACTIVE'] ?? 'neutral'}>{p.status ?? 'ACTIVE'}</Badge></td>
                        <td>
                          <Link className="row-action" href={`/people/${p.id}`} aria-label={`Open ${p.firstName} ${p.lastName}`}>
                            <ChevronLeft size={16}/>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-people">
              <Users size={28}/>
              <p>شخصی در محدودهٔ فعلی یافت نشد.</p>
              {writable && <Link className="srip-button primary" href="#add-person"><Plus size={14}/> افزودن اولین شخص</Link>}
            </div>
          )}
        </Card>

        {/* Create form */}
        {writable ? (
          <Card className="person-create" id="add-person">
            <div className="panel-title"><div><h2>افزودن شخص</h2><p>ایجاد مستقیم از این صفحه</p></div></div>
            <form onSubmit={create} className="form-grid">
              <label>نام <input value={first} onChange={(e) => setFirst(e.target.value)} required /></label>
              <label>نام خانوادگی <input value={last} onChange={(e) => setLast(e.target.value)} required /></label>
              <label className="full">ایمیل <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="full">تلفن <input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
              <label className="full">سمت <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً مدیر فروش" /></label>
              <label className="full">بخش <input value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
              <label className="full">سازمان
                <select value={org} onChange={(e) => setOrg(e.target.value)} required>
                  <option value="">انتخاب کنید</option>
                  {orgs.map((o) => <option value={o.id} key={o.id}>{o.name}</option>)}
                </select>
              </label>
              <button className="srip-button primary full" type="submit" disabled={saving}>
                {saving ? 'در حال ذخیره…' : 'ایجاد شخص'}
              </button>
            </form>
          </Card>
        ) : (
          <Card className="person-create">
            <div className="panel-title"><div><h2>افزودن شخص</h2><p>دسترسی لازم</p></div></div>
            <div className="empty-people"><p>برای ایجاد شخص به دسترسی person.write نیاز دارید.</p></div>
          </Card>
        )}
      </section>
    </div>
  );
}

function scoreTone(v: number | undefined) {
  const n = v ?? 0;
  if (n >= 80) return 'hi';
  if (n >= 50) return 'mid';
  return 'lo';
}
