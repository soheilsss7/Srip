'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {DataTable,Empty,ErrorCard,Loading,PageHeader} from '../_components/page-ui';import{useWorkspace}from'../_components/workspace';
export default function Monitoring(){
 const{can}=useWorkspace();
 const allowed=can('metrics.read');
 const [d,setD]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{if(!allowed)return;api('/metrics/api-latency').then(setD).catch(x=>setE((x as Error).message))},[allowed]);
 const entries=Array.isArray(d)?d.map((x:any)=>({route:x?.route??'—',count:x?.count??0,sum:Number(x?.sum??0),avg:Number(((Number(x?.sum??0)/((x?.count??1)||1)).toFixed(2)))})):Object.entries<Record<string,any>>(d??{}).map(([route,h]:[string,Record<string,any>])=>({route,count:h?.count??0,sum:Number(h?.sum??0),avg:Number(((Number(h?.sum??0)/((h?.count??1)||1)).toFixed(2)))}));
 const rows=entries.map(x=>({route:x.route??'—',count:x.count??0,sum:typeof x.sum==='number'?x.sum.toFixed(2)+'ms':String(x.sum??'—'),avg:typeof x.avg==='number'?x.avg+'ms':String(x.avg??'—')}));
 if(!allowed)return <main className="feature-page"><PageHeader eyebrow="OBSERVABILITY" title="Monitoring" description="API latency بر اساس route."/><section className="panel"><Empty>مجوز مشاهده Monitoring برای شما فعال نیست.</Empty></section></main>;
 return <main className="feature-page"><PageHeader eyebrow="OBSERVABILITY" title="Monitoring" description="API latency بر اساس route — histogram با count و cumulated sum از endpoint تشخیصی واقعی Backend."/><ErrorCard message={e}/>{!d&&!e?<Loading/>:d&&<section className="panel">{rows.length?<DataTable columns={[{key:'route',label:'Route'},{key:'count',label:'تعداد'},{key:'sum',label:'Sum'},{key:'avg',label:'میانگین'}]} rows={rows}/>:<Empty>هیچ نمونه latency ثبت نشده است.</Empty>}</section>}</main>;
}
