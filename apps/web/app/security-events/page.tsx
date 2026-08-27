'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';

type Evt = { id: string; type?: string; severity?: string; ipAddress?: string | null; userAgent?: string | null; entityType?: string | null; entityId?: string | null; organizationId?: string | null; createdAt?: string };

const sevTone: Record<string, 'danger'|'warning'|'success'|'info'> = { HIGH:'danger', MEDIUM:'warning', WARNING:'warning', LOW:'success', INFO:'info' };

export default function SecurityEvents(){
  const [items,setItems]=useState<Evt[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{api('/security/events').then((x:any)=>setItems(Array.isArray(x)?x:x?.items??x?.rows??[])).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[]);
  const info = items.map(e=>({
    type: e.type ?? '—',
    severity: <Badge tone={sevTone[e.severity ?? ''] ?? 'info'}>{e.severity ?? '—'}</Badge>,
    ip: e.ipAddress ?? '—',
    entity: e.entityType ? `${e.entityType}${e.entityId ? ':'+e.entityId.slice(0,6) : ''}` : '—',
    created: e.createdAt ? new Date(e.createdAt).toLocaleString('fa-IR') : '—',
    id: e.id.slice(0,8),
  }));
  return <main className="feature-page"><PageHeader eyebrow="SECURITY" title="Security Events" description="رخدادهای امنیتی ثبت‌شده: SUSPICIOUS_ACCESS، TOKEN_CHANGE، EXPORT_CREATED و… همراه با شدت و شناسه‌ی entity مربوطه." actions={<Badge tone="info">{items.length} رویداد (آخرین ۲۰۰)</Badge>}/><ErrorCard message={error}/>{loading?<Loading/>:<section className="panel"><div className="table-wrap">{items.length?<DataTable columns={[{key:'type',label:'نوع'},{key:'severity',label:'شدت'},{key:'ip',label:'IP'},{key:'entity',label:'Entity'},{key:'created',label:'زمان'},{key:'id',label:'ID'}]} rows={info}/>:<Empty>رویداد امنیتی‌ای ثبت نشده است.</Empty>}</div></section>}</main>;
}
