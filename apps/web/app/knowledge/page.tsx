'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,DataTable} from '../_components/page-ui';
export default function Knowledge(){
 const [status,setStatus]=useState<any>(null),[rows,setRows]=useState<any[]>([]),[e,setE]=useState('');
 useEffect(()=>{Promise.all([api('/documents/status'),api('/documents')]).then(([s,d])=>{setStatus(s);setRows(Array.isArray(d)?d:(d as {items?:unknown[];rows?:unknown[]}).items??(d as {rows?:unknown[]}).rows??[])}).catch(x=>setE(x.message))},[]);
 return <main className="feature-page"><PageHeader eyebrow="INSTITUTIONAL MEMORY" title="Knowledge" description="دانش سازمانی: اسناد، Meeting Notes، Relationship Notes و Industry/Organization Intelligence با Scope و Classification." actions={<a className="primary-action" href="/data-management/import">ورود داده</a>}/><ErrorCard message={e}/>{!status&&!e?<Loading/>:<><section className="stat-row"><div className="stat-box"><span>Storage</span><strong>{status?.storage??status?.status??'—'}</strong></div><div className="stat-box"><span>Indexing</span><strong>{status?.indexing??'—'}</strong></div><div className="stat-box"><span>Documents</span><strong>{rows.length}</strong></div></section><section className="panel"><h2>Documents</h2><DataTable columns={['id','name','classification','createdAt'].map(k=>({key:k,label:k}))} rows={rows}/></section></>}</main>
}
