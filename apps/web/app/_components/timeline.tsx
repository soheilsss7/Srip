'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
export function Timeline({entityType,entityId}:{entityType:string;entityId:string}){
 const [rows,setRows]=useState<any[]>([]),[e,setE]=useState('');
 useEffect(()=>{api<any>(`/timeline/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`).then(x=>setRows(Array.isArray(x)?x:x?.items??x?.rows??[])).catch(x=>setE(x.message))},[entityType,entityId]);
 return <section className="timeline panel"><div className="panel-title"><div><h2>Timeline</h2><p>رویدادهای ثبت‌شده توسط Backend</p></div></div>{e?<div className="error-card">{e}</div>:rows.length?rows.map((x,i)=><article className="timeline-item" key={x.id??i}><i/><div><strong>{x.title??x.type??'Event'}</strong><p>{x.description??x.message??''}</p><small>{x.createdAt??x.occurredAt??''}</small></div></article>):<div className="empty-state">رویدادی ثبت نشده است.</div>}</section>
}