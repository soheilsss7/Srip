'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {Badge,DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';

type Perm = { key?: string; description?: string | null; rolePermissions?: Array<{ role?: { key?: string } | string }> };
const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];

export default function Authorization(){
  const {can}=useWorkspace();
  const allowed=can('enterprise.admin');
  const [items,setItems]=useState<Perm[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{if(!allowed){setLoading(false);return}api('/admin/permissions').then((x:any)=>setItems(unwrap(x))).catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[allowed]);
  const rolesOf=(p:Perm)=>Array.isArray(p.rolePermissions)?p.rolePermissions.map(rp=>{const r=rp?.role;return typeof r==='string'?r:r?.key;}).filter(Boolean).join('، '):'—';
  const rows=items.map(p=>({key:p.key??'—',description:p.description??'—',roles:rolesOf(p)}));
  if(!allowed)return <main className="feature-page"><PageHeader eyebrow="AUTHORIZATION" title="Authorization" description="فهرست Permission های Backend."/><section className="panel"><Empty>مجوز مدیریت Authorization برای شما فعال نیست.</Empty></section></main>;
  return <main className="feature-page"><PageHeader eyebrow="AUTHORIZATION" title="Authorization" description="فهرست Permission های Backend و Role های صاحب هرکدام — مبنای RBAC و Scope-aware access." actions={<Badge tone="info">{items.length} permission</Badge>}/><ErrorCard message={error}/>{loading?<Loading/>:<section className="panel"><div className="table-wrap">{items.length?<DataTable columns={[{key:'key',label:'Permission Key'},{key:'description',label:'توضیح'},{key:'roles',label:'Roles'}]} rows={rows}/>:<Empty>هیچ Permission ای یافت نشد.</Empty>}</div></section>}</main>;
}
