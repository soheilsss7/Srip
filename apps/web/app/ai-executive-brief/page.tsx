'use client';
import {useEffect,useState} from 'react';
import {apiGet} from '../_lib/api';
import {Empty,Loading} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';
export default function Page(){
 const {can}=useWorkspace();
 const allowed=can('ai.executive_brief');
 const[r,setR]=useState<any>(null),[e,setE]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!allowed){setLoading(false);return}setLoading(true);apiGet('/ai/executive-brief').then(setR).catch(x=>setE(x?.message||'Unable to load brief')).finally(()=>setLoading(false))},[allowed]);
 if(!allowed)return <main className="feature-page"><section className="panel"><Empty>مجوز مشاهده گزارش اجرایی هوش مصنوعی برای شما فعال نیست.</Empty></section></main>;
 const result=r?.result;
 const summary=result?.summary&&typeof result.summary==='object'?result.summary:{};
 const recommendations=Array.isArray(result?.recommendations)?result.recommendations:[];
 const evidence=result?.evidence&&typeof result.evidence==='object'?result.evidence:{};
 return <main className="shell"><header className="topbar"><strong>SRIP</strong><a href="/reports">Reports</a></header><section className="hero"><p className="eyebrow">AI Executive Brief</p><h1>Weekly strategic brief</h1><p>Permission-aware summary of changes, opportunities, risks, meetings, commitments and recommended actions.</p></section>{e&&<div className="card" role="alert">{e}</div>}{loading?<Loading/>:!result?<div className="card"><Empty>گزارش اجرایی برای این محدوده داده‌ای ندارد.</Empty></div>:<><section className="grid">{Object.entries(summary).map(([k,v])=><article className="card" key={k}><strong>{String(v)}</strong><div>{k}</div></article>)}</section><section className="card"><h2>Recommended actions</h2>{recommendations.length?<ul>{recommendations.map((x:string)=><li key={x}>{x}</li>)}</ul>:<Empty>اقدام پیشنهادی ثبت نشده است.</Empty>}</section><section className="card"><h2>Evidence</h2>{Object.keys(evidence).length?<div>{Object.entries(evidence).map(([k,v])=><div key={k}><strong>{k}: </strong>{Array.isArray(v)?`${v.length} مورد شواهد قابل مشاهده`:v==null?'—':'ثبت‌شده'}</div>)}</div>:<p>No evidence recorded.</p>}</section></>}</main>
}
