'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {DataTable,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
export default function Intelligence(){
 const [data,setData]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{Promise.all([api('/intelligence/risk-signals'),api('/intelligence/opportunity-detection'),api('/intelligence/strategic-coverage'),api('/intelligence/network')]).then(([r,o,c,n])=>setData({r,o,c,n})).catch(x=>setE(x.message))},[]);
 const list=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
 return <main className="feature-page"><PageHeader eyebrow="STRATEGIC INTELLIGENCE" title="هوشمندی شبکه" description="Relationship Health، Risk Detection، Opportunity Detection، Strategic Coverage و Network Intelligence؛ بدون فعال‌کردن AI Provider."/><ErrorCard message={e}/>{!data&&!e?<Loading/>:<><section className="dashboard-grid"><article className="panel"><h2>Risk Signals</h2><DataTable columns={['id','type','severity','score','createdAt'].map(k=>({key:k,label:k}))} rows={list(data.r)}/></article><article className="panel"><h2>Opportunity Detection</h2><DataTable columns={['id','type','score','status','createdAt'].map(k=>({key:k,label:k}))} rows={list(data.o)}/></article></section><section className="dashboard-grid"><article className="panel"><h2>Strategic Coverage</h2><pre className="json-view">{JSON.stringify(data.c,null,2)}</pre></article><article className="panel"><h2>Network Intelligence</h2><pre className="json-view">{JSON.stringify(data.n,null,2)}</pre></article></section></>}</main>
}
