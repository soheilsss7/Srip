'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {Badge,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {RelatedNotes} from '../../_components/related-notes';
import {QuickCreate} from '../../_components/quick-create';
import {useWorkspace} from '../../_components/workspace';
type Panel='unit'|'contact';
const UNIT_TYPES=['DEPARTMENT','DIVISION','BRANCH','BUSINESS_UNIT','LOCATION','OTHER'];
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const {can}=useWorkspace();
 const canRead=can('org.read');
 const canWrite=can('org.write');
 const canRestore=can('data.restore');
 const [o,setO]=useState<any>(null),[units,setUnits]=useState<any[]>([]),[contacts,setContacts]=useState<any[]>([]),[timeline,setTimeline]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(''),[panel,setPanel]=useState<Panel|null>(null),[quickOpen,setQuickOpen]=useState(false);
 const [unitForm,setUnitForm]=useState({name:'',type:'DEPARTMENT',parentUnitId:''});
 const [ctForm,setCtForm]=useState({kind:'PHONE',value:'',label:'',isPrimary:false});
 const arr=(x:any)=>Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.data)?x.data:Array.isArray(x?.rows)?x.rows:[];
  const load=useCallback(async()=>{if(!canRead){setO(null);return}setError('');try{const [org,unitRows,tl]=await Promise.all([api(`/organizations/${id}`),api(`/core-domain/organizations/${id}/units`),api(`/organizations/${id}/timeline`)]);setO(org);setUnits(arr(unitRows));setTimeline(arr(tl))}catch(e){setError((e as Error).message)}},[id,canRead]);
  const loadContacts=useCallback(async()=>{if(!canRead){setContacts([]);return}setError('');try{setContacts(arr(await api(`/core-domain/organizations/${id}/contacts`)))}catch(e){setError((e as Error).message)}},[id,canRead]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{void loadContacts()},[loadContacts]);
 async function doIt(label:string,fn:()=>Promise<any>,allowed=canWrite){if(!allowed)return;setBusy(label);setError('');try{await fn();await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
  async function addUnit(e:React.FormEvent){e.preventDefault();await doIt('unit',()=>api(`/core-domain/organizations/${id}/units`,{method:'POST',body:JSON.stringify({name:unitForm.name,type:unitForm.type,parentUnitId:unitForm.parentUnitId||undefined})}));setUnitForm({name:'',type:'DEPARTMENT',parentUnitId:''});setPanel(null)}
  async function addContact(e:React.FormEvent){e.preventDefault();await doIt('ct',()=>api(`/core-domain/organizations/${id}/contacts`,{method:'POST',body:JSON.stringify(ctForm)}));setCtForm({kind:'PHONE',value:'',label:'',isPrimary:false});setPanel(null);await loadContacts()}
 const info=o?Object.entries(o).filter(([k])=>!['units'].includes(k)&&typeof o[k]!=='function'&&k!=='timeline').slice(0,24):[];
 const flattened=units.flatMap((u:any)=>[{u,depth:0},...(u.children??[]).map((c:any)=>({u:c,depth:1})),(u.children??[]).flatMap((c:any)=>(c.children??[]).map((g:any)=>({u:g,depth:2})))].flat());
 if(!canRead)return <main className="feature-page"><PageHeader eyebrow="ORGANIZATION" title="Organization" description="جزئیات سازمان، واحدها، تماس‌ها، روابط و یادداشت‌های مرتبط."/><section className="panel"><p className="empty-state">مجوز مشاهده این سازمان برای شما فعال نیست.</p></section></main>;
 return <main className="feature-page">
  <PageHeader eyebrow="ORGANIZATION" title={o?.name??'Organization'} description="جزئیات سازمان، واحدها، تماس‌ها، روابط و یادداشت‌های مرتبط." actions={<div className="toolbar"><button className="secondary-action" onClick={load} disabled={!!busy}>بازخوانی</button>{canWrite&&<><button className="primary-action" onClick={()=>setQuickOpen(true)} disabled={!!busy}>+ ثبت سریع</button><button className="primary-action" onClick={()=>setPanel('unit')} disabled={!!busy}>+ واحد</button><button className="primary-action" onClick={()=>setPanel('contact')} disabled={!!busy}>+ تماس</button></>}{o?.deletedAt?(canRestore&&<button className="primary-action" disabled={!!busy} onClick={()=>doIt('restore',()=>api(`/organizations/${id}/restore`,{method:'POST'}),canRestore)}>بازیابی</button>):(canWrite&&<button className="danger-action" disabled={!!busy} onClick={()=>{if(confirm('این سازمان بایگانی شود؟'))doIt('archive',()=>api(`/organizations/${id}/archive`,{method:'PATCH'}))}}>بایگانی</button>)}</div>}/>
  <ErrorCard message={error}/>
  {!o&&!error?<Loading/>:o&&<>
   <section className="panel"><div className="panel-title"><div><h2>اطلاعات سازمان</h2><Badge tone={o.status==='ACTIVE'?'success':o.status==='ARCHIVED'?'danger':'neutral'}>{o.status??'—'}</Badge></div></div><div className="detail-grid">{info.map(([k,v])=>{if(v==null||v==='')return null;return <div className="detail-item" key={k}><small>{k}</small><strong>{typeof v==='object'?JSON.stringify(v):String(v)}</strong></div>})}</div></section>
   <div className="split-panels">
    <section className="panel"><div className="panel-title"><div><h2>واحدها (Units)</h2><Badge>{units.length}</Badge></div></div>{flattened.length?<div className="list">{flattened.map(({u,index}:any,i:number)=><div className="listRow" key={u.id??i}><Badge tone="neutral">{u.type}</Badge><span className={u.depth?'indent':''}><strong>{'‏'.repeat(u.depth)}{u.name}</strong>{u.children?.length?<small>{u.children.length} زیرمجموعه</small>:null}</span></div>)}</div>:<p className="empty-state">واحدی ثبت نشده است.</p>}</section>
    <section className="panel"><div className="panel-title"><div><h2>اطلاعات تماس</h2><Badge>{contacts.length}</Badge></div></div>{contacts.length?<div className="list">{contacts.map((c:any)=><div className="listRow" key={c.id}><Badge tone={c.isPrimary?'success':'neutral'}>{c.kind}</Badge><span><strong>{c.value}</strong><small>{c.label||''}{c.isPrimary?' · تماس اصلی':''}</small></span></div>)}</div>:<p className="empty-state">تماسی ثبت نشده است.</p>}</section>
   </div>
   <section className="panel"><div className="panel-title"><div><h2>Timeline</h2><Badge>{timeline.length}</Badge></div></div>{timeline.length?<div className="list">{timeline.slice(0,50).map((x:any,i:number)=><div className="listRow" key={x.id??i}><Badge tone="neutral">{(x as any).kind??'EVENT'}</Badge><span><strong>{x.title||x.subject||x.description||x.name||x.eventType||'—'}</strong>{(x.date||x.createdAt)?<small>{new Date(x.date??x.createdAt).toLocaleString()}</small>:null}</span></div>)}</div>:<p className="empty-state">رویدادی ثبت نشده است.</p>}</section>
   <RelatedNotes notes={o.notes} title="یادداشت‌های سازمان" />
   {canWrite&&panel==='unit'&&<section className="panel"><div className="panel-title"><h2>واحد جدید</h2><button onClick={()=>setPanel(null)}>انصراف</button></div><form className="entity-form" onSubmit={addUnit}><label>نام<input required value={unitForm.name} onChange={e=>setUnitForm({...unitForm,name:e.target.value})}/></label><label>نوع<select value={unitForm.type} onChange={e=>setUnitForm({...unitForm,type:e.target.value})}>{UNIT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>واحد والد (اختیاری)<select value={unitForm.parentUnitId} onChange={e=>setUnitForm({...unitForm,parentUnitId:e.target.value})}><option value="">—</option>{units.map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><button className="primary-action" disabled={!!busy}>{busy==='unit'?'در حال ذخیره…':'ثبت واحد'}</button></form></section>}
   {canWrite&&panel==='contact'&&<section className="panel"><div className="panel-title"><h2>اطلاعات تماس جدید</h2><button onClick={()=>setPanel(null)}>انصراف</button></div><form className="entity-form" onSubmit={addContact}><label>نوع<select value={ctForm.kind} onChange={e=>setCtForm({...ctForm,kind:e.target.value})}>{['PHONE','EMAIL','ADDRESS','WEBSITE','LINKEDIN','OTHER'].map(k=><option key={k} value={k}>{k}</option>)}</select></label><label>مقدار<input required value={ctForm.value} onChange={e=>setCtForm({...ctForm,value:e.target.value})}/></label><label>برچسب<input value={ctForm.label} onChange={e=>setCtForm({...ctForm,label:e.target.value})}/></label><label className="checkbox-label"><input type="checkbox" checked={ctForm.isPrimary} onChange={e=>setCtForm({...ctForm,isPrimary:e.target.checked})}/>تماس اصلی</label><button className="primary-action" disabled={!!busy}>{busy==='ct'?'در حال ذخیره…':'ثبت تماس'}</button></form></section>}
   {canWrite&&<QuickCreate open={quickOpen} onClose={()=>setQuickOpen(false)} onCreated={load} context={{organizationId:id}} />}
  </>}
 </main>;
}