'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, unwrapList } from '../_lib/api';

type Entity = { id: string; label?: string; name?: string; displayName?: string; firstName?: string; lastName?: string; type?: string; organization?: { name?: string } };

type EntityPickerProps = {
  value: string;
  onChange: (id: string) => void;
  endpoint: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  scopeId?: string;
  selectedLabel?: string;
  onLabelChange?: (id: string, label: string) => void;
};

function labelOf(entity: Entity) {
  return entity.label || entity.name || entity.displayName || [entity.firstName, entity.lastName].filter(Boolean).join(' ') || entity.id;
}

export function EntityPicker({ value, onChange, endpoint, label, placeholder = 'جست‌وجو و انتخاب…', required, disabled, scopeId = 'all', selectedLabel, onLabelChange }: EntityPickerProps) {
  const [items, setItems] = useState<Entity[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => items.find(item => item.id === value), [items, value]);
  const selectedOptionLabel = selected ? labelOf(selected) : selectedLabel || (value ? 'موجودیت انتخاب‌شده' : '');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams({ page: '1', pageSize: '50' });
        if (query.trim()) params.set(endpoint.includes('/people') || endpoint.includes('/organizations') || endpoint.includes('/relationships') ? 'q' : 'search', query.trim());
        if (scopeId !== 'all') params.set('organizationId', scopeId);
        const response = await api<any>(`${endpoint}?${params.toString()}`);
        if (!cancelled) setItems(unwrapList<Entity>(response));
      } catch (value) {
        if (!cancelled) setError((value as Error).message);
      } finally { if (!cancelled) setLoading(false); }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [endpoint, query, scopeId]);

  return <label className="entity-picker">{label}<input value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجو با نام…" disabled={disabled} aria-label={`جست‌وجوی ${label}`} /><select value={value} required={required} disabled={disabled || loading} onChange={event => { const id = event.target.value; onChange(id); const item = items.find(candidate => candidate.id === id); if (item) onLabelChange?.(id, labelOf(item)); }}><option value="">{loading ? 'در حال بارگذاری…' : placeholder}</option>{value && !selected && <option value={value}>{selectedOptionLabel}</option>}{items.map(item => <option key={item.id} value={item.id}>{labelOf(item)}{item.organization?.name ? ` · ${item.organization.name}` : item.type ? ` · ${item.type}` : ''}</option>)}</select>{error && <small className="field-error">{error}</small>}</label>;
}
