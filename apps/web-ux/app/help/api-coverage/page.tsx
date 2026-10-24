'use client';import {useEffect,useMemo,useState} from 'react';
import {PageHeader,DataTable} from '../../_components/page-ui';
import {apiDocsJson} from '../../_lib/api';
import {apiPathFa,moduleFa} from '../../_lib/fa';
type Row={module:string;method:string;path:string;status:string};
export default function ApiCoverage(){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState('');
 const [q,setQ]=useState('');
 useEffect(()=>{
  apiDocsJson().then(spec=>{
   const out:Row[]=[];const paths=spec?.paths??{};
   for(const [path,item] of Object.entries<any>(paths))for(const [method,op] of Object.entries<any>(item??{})){
    if(!['get','post','put','patch','delete'].includes(method))continue;
    out.push({module:(op?.tags?.[0]??path.split('/')[2]??'api'),method:method.toUpperCase(),path:`/api/v1${path}`,status:op?.security?.length? 'توکن امنیتی الزامی':'عمومی'});
   }
   setRows(out.sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method)));
  }).catch(e=>setError(e instanceof Error?e.message:String(e)));
 },[]);
 const filtered=useMemo(()=>rows.filter(r=>(r.module+' '+r.path+' '+r.method).toLowerCase().includes(q.toLowerCase())).map(r=>({...r,module:moduleFa(r.module),method:r.method==='GET'?'دریافت':r.method==='POST'?'ثبت':r.method==='PUT'?'جایگزینی':r.method==='PATCH'?'به‌روزرسانی':'حذف',path:apiPathFa(r.method,r.path)})),[rows,q]);
 return <main className="feature-page"><PageHeader eyebrow="قابل ردیابی‌بودن" title="پوشش رابط‌ها" description="رجیستری زندهٔ نقطه‌های اتصال مستقیماً از قرارداد باز رابط واقعی سرور خوانده می‌شود؛ نه از یک فهرست دستی."/>
 {error&&<div className="error-card">{error}</div>}
 <section className="panel"><input placeholder="فیلتر مسیر / متد / ماژول…" value={q} onChange={e=>setQ(e.target.value)}/>
 <DataTable columns={[{key:'module',label:'ماژول'},{key:'method',label:'متد'},{key:'path',label:'مسیر'},{key:'status',label:'احراز هویت'}]} rows={filtered}/></section></main>;
}