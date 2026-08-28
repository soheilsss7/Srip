'use client';import {useEffect,useMemo,useState} from 'react';
import {PageHeader,DataTable} from '../_components/page-ui';
import {API} from '../_lib/api';
type Row={module:string;method:string;path:string;status:string};
function origin(){try{return API.replace(/\/api\/v1\/?$/,'')}catch{return 'http://localhost:4000'}}
export default function ApiCoverage(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState('');
 const [q,setQ]=useState('');
 useEffect(()=>{
  fetch(`${origin()}/docs-json`).then(r=>{if(!r.ok)throw new Error(`GET /docs-json → ${r.status}`);return r.json()}).then(spec=>{
   const out:Row[]=[];const paths=spec?.paths??{};
   for(const [path,item] of Object.entries<any>(paths))for(const [method,op] of Object.entries<any>(item??{})){
    if(!['get','post','put','patch','delete'].includes(method))continue;
    out.push({module:(op?.tags?.[0]??path.split('/')[2]??'api'),method:method.toUpperCase(),path:`/api/v1${path}`,status:op?.security?.length? 'Bearer · contract enforced':'Public'});
   }
   setRows(out.sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method)));
  }).catch(e=>setError(e instanceof Error?e.message:String(e)));
 },[]);
 const filtered=useMemo(()=>rows.filter(r=>(r.module+' '+r.path+' '+r.method).toLowerCase().includes(q.toLowerCase())),[rows,q]);
 return <main className="feature-page"><PageHeader eyebrow="TRACEABILITY" title="API Coverage" description="رجیستری زنده‌ی Endpointها مستقیماً از OpenAPI contract واقعی Backend (<code>/docs-json</code>) خوانده می‌شود؛ نه از یک لیست دستی."/>
 {error&&<div className="error-card">{error}</div>}
 <section className="panel"><input placeholder="فیلتر path / method / module…" value={q} onChange={e=>setQ(e.target.value)}/>
 <DataTable columns={[{key:'module',label:'Module'},{key:'method',label:'Method'},{key:'path',label:'Path'},{key:'status',label:'Auth'}]} rows={filtered}/></section></main>;
}