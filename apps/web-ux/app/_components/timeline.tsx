'use client';
import {useEffect,useState} from 'react';
import {fa} from '../_lib/fa';
import {api,unwrapList} from '../_lib/api';
import { t } from '../_lib/i18n';

function endpoint(entityType:string,entityId:string):string{
  // Real backend timeline routes are entity-specific; a generic /timeline route does not exist.
  switch(entityType){
    case 'organization': return `/organizations/${encodeURIComponent(entityId)}/timeline`;
    case 'person': return `/people/${encodeURIComponent(entityId)}/timeline`;
    case 'relationship': return `/relationships/${encodeURIComponent(entityId)}/timeline`;
    case 'interaction': return `/interactions/timeline/${encodeURIComponent(entityId)}`;
    default: return `/organizations/${encodeURIComponent(entityId)}/timeline`;
  }
}

export function Timeline({entityType,entityId}:{entityType:string;entityId:string}){
  const [rows,setRows]=useState<any[]>([]),[e,setE]=useState('');
  useEffect(()=>{setRows([]);setE('');api<any>(endpoint(entityType,entityId)).then(x=>setRows(unwrapList(x?.items??x))).catch((x:Error)=>setE(x.message))},[entityType,entityId]);
  return <section className="timeline panel"><div className="panel-title"><div><h2>{t('خط زمانی')}</h2><p>{t('رویدادهای ثبت‌شده توسط سرور')}</p></div></div>{e?<div className="error-card">{e}</div>:rows.length?rows.map((x,i)=><article className="timeline-item" key={x.id??i}><i/><div><strong>{x.title??x.subject??x.name??x.description??fa(x.kind)??t('رویداد')}</strong><p>{x.summary??x.outcome??fa(x.status)??''}</p><small>{(x.date??x.createdAt??x.occurredAt??x.startAt??'').toString()}</small></div></article>):<div className="empty-state">{t('رویدادی ثبت نشده است.')}</div>}</section>
}