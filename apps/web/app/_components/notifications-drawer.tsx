'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';

function notificationDate(value: unknown){
  if(!value)return '';
  const date=new Date(String(value));
  return Number.isNaN(date.getTime())?'':date.toLocaleString('fa-IR');
}

export function NotificationsDrawer({open,onClose}:{open:boolean;onClose:()=>void}){
 const [items,setItems]=useState<any[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{const x=await api<any>('/notifications?limit=30');setItems(Array.isArray(x)?x:x?.items??x?.rows??[])}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{if(open)void load()},[open]);
 if(!open)return null;
 async function read(notification:any){const id=String(notification?.id??'');if(!id||busy)return;setBusy(id);setError('');try{await api(`/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'});setItems(x=>x.map(n=>n.id===id?{...n,read:true,readAt:new Date().toISOString()}:n));if(notification.deepLink)window.location.assign(notification.deepLink)}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function readAll(){if(busy)return;setBusy('all');setError('');try{await api('/notifications/read-all',{method:'PATCH'});setItems(x=>x.map(n=>({...n,read:true,readAt:new Date().toISOString()})))}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 return <aside className="notification-drawer" aria-label="اعلان‌ها"><header><div><span className="eyebrow">NOTIFICATION CENTER</span><h2>اعلان‌ها</h2></div><button onClick={onClose} aria-label="بستن">×</button></header><div className="drawer-actions"><button onClick={readAll} disabled={!!busy}>همه خوانده شد</button><button onClick={()=>void load()} disabled={!!busy} aria-label="بازخوانی">↻</button></div>{loading?<p>در حال بارگذاری…</p>:items.length?items.map(n=><button className={'notification-item '+(!n.read?'unread':'')} key={n.id} onClick={()=>void read(n)} disabled={!!busy}><strong>{n.title??n.type??'Notification'}</strong><span>{n.message??n.body??''}</span><small>{notificationDate(n.createdAt)}</small></button>):<p>اعلانی وجود ندارد.</p>}{error&&<div className="error-card" role="alert">{error}</div>}</aside>
}
