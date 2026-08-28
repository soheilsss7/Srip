'use client';
import {useState} from 'react';
import {api} from '../_lib/api';
import {PageHeader,ErrorCard} from '../_components/page-ui';

const INTENTS=['SMART_SEARCH','MEETING_BRIEF','MEETING_SUMMARY','ACTION_EXTRACTION','COMMITMENT_EXTRACTION','RISK_DETECTION','OPPORTUNITY_DETECTION','NEXT_BEST_ACTION','EXECUTIVE_BRIEF'];

function renderValue(v:any):React.ReactNode{
  if(v==null)return <span>—</span>;
  if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return <span>{String(v)}</span>;
  if(Array.isArray(v))return <ul>{v.map((x,i)=><li key={i}>{typeof x==='object'?<pre className="pref" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(x,null,2)}</pre>:String(x)}</li>)}</ul>;
  return <pre className="pref" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(v,null,2)}</pre>;
}

export default function AI(){
  const [intent,setIntent]=useState('SMART_SEARCH'),[query,setQuery]=useState(''),[result,setResult]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState('');
  async function ask(e:React.FormEvent){e.preventDefault();setBusy('query');setError('');setResult(null);try{const r:any=await api('/ai/query',{method:'POST',body:JSON.stringify({intent,query})});setResult(r)}catch(x){setError((x as Error).message)}finally{setBusy('')}}
  const body=result?.result??result?.answer??result;
  return <main className="feature-page">
    <PageHeader eyebrow="AI ASSISTANT" title="AI Query" description="پرس‌وجوی permission-aware با intent مشخص روی داده‌های CRM."/>
    <ErrorCard message={error}/>
    <section className="panel">
      <form className="entity-form" onSubmit={ask}>
        <label>Intent<select value={intent} onChange={e=>setIntent(e.target.value)}>{INTENTS.map(i=><option key={i} value={i}>{i}</option>)}</select></label>
        <label>Query<textarea value={query} onChange={e=>setQuery(e.target.value)} placeholder="متن پرس‌وجو…" rows={4} required/></label>
        <button className="primary-action" disabled={!!busy}>{busy==='query'?'در حال پردازش…':'ارسال'}</button>
      </form>
    </section>
    {result&&<section className="panel">
      <div className="panel-title"><h2>نتیجه</h2></div>
      {typeof body==='object'&&body!==null?Object.entries(body).map(([k,v])=>{if(v==null)return null;return <div className="detail-item" key={k}><small>{k}</small><div>{renderValue(v)}</div></div>}):
      body!=null?<div className="card">{String(body)}</div>:null}
      {result?.intent?<p className="muted">intent: {result.intent}</p>:null}
    </section>}
  </main>;
}
