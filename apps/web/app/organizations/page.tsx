'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api,unwrapList } from '../_lib/api';
import { EntityPicker } from '../_components/entity-picker';
import { useWorkspace } from '../_components/workspace';

type Org = { id:string; name:string; type:string; industry?:string; country?:string; owner?:{name:string}; _count?:{people:number;sourceRelationships:number;targetRelationships:number;projects:number;opportunities:number} };
export default function Page(){
 const {scopeId,can}=useWorkspace();
 const canRead=can('org.read');
 const canWrite=can('org.write');
 const [items,setItems]=useState<Org[]>([]); const [name,setName]=useState(''); const [type,setType]=useState('OTHER'); const [parent,setParent]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
 async function load(){if(!canRead){setItems([]);setLoading(false);return}setLoading(true);try{setItems(unwrapList<Org>(await api('/organizations?page=1&pageSize=50')))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[canRead]);
 async function create(e:FormEvent){e.preventDefault();if(!canWrite)return;setError('');try{await api('/organizations',{method:'POST',body:JSON.stringify({name:name.trim(),type,parentOrganizationId:parent||undefined})});setName('');setParent('');await load()}catch(e){setError((e as Error).message)}}
 if(!canRead)return <main className="shell"><section className="card"><h1>Organizations</h1><p className="empty-state">مجوز مشاهده سازمان‌ها برای شما فعال نیست.</p></section></main>;
 return <main className="shell"><header className="topbar"><strong>SRIP</strong><nav><a href="/">Dashboard</a><a href="/people">People</a><a href="/relationships">Relationships</a></nav></header><section className="hero"><p className="eyebrow">Phase 7 · Core Domain</p><h1>Organizations</h1><p>Organization hierarchy, ownership, people and relationship context.</p></section><section className="grid2">{canWrite&&<form className="card" onSubmit={create}><h2>افزودن سازمان</h2><label>نام<input value={name} onChange={e=>setName(e.target.value)} minLength={2} required/></label><label>نوع<select value={type} onChange={e=>setType(e.target.value)}><option>HOLDING</option><option>SUBSIDIARY</option><option>CUSTOMER</option><option>PARTNER</option><option>BANK</option><option>GOVERNMENT</option><option>INVESTOR</option><option>SUPPLIER</option><option>OTHER</option></select></label><EntityPicker label="سازمان مادر (اختیاری)" endpoint="/organizations" value={parent} onChange={setParent} scopeId={scopeId}/><button type="submit">ایجاد سازمان</button>{error&&<p className="error">{error}</p>}</form>}<section className="card"><h2>Directory</h2>{loading?<p>در حال بارگذاری…</p>:items.length===0?<p>سازمانی ثبت نشده است.</p>:<div className="list">{items.map(o=><article className="listRow" key={o.id}><div><strong><a href={`/organizations/${o.id}`}>{o.name}</a></strong><small>{o.type}{o.industry?` · ${o.industry}`:''}</small></div><span>{o._count?.people??0} people · {(o._count?.sourceRelationships??0)+(o._count?.targetRelationships??0)} relationships</span></article>)}</div>}</section></section></main>}
