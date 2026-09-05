'use client';
import Link from 'next/link';
import React, { useEffect } from 'react';
import {Badge as DSBadge, EmptyState, ErrorState} from '@srip/design-system';
import { X } from 'lucide-react';

export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:React.ReactNode}){
 return <header className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="heading-tools">{actions}</div>}</header>
}
export function ErrorCard({message}:{message?:string}){return message?<ErrorState message={message}/>:null}
export function Loading({label='در حال بارگذاری…'}:{label?:string}){return <div className="loading-strip" aria-live="polite">{label}</div>}
export function Empty({children='داده‌ای برای نمایش وجود ندارد.'}){return <EmptyState title="">{children}</EmptyState>}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'info'}){return <DSBadge className={`${tone}`}>{children}</DSBadge>}
export function DataTable({columns,rows,empty='داده‌ای وجود ندارد.'}:{columns:{key:string;label:string}[];rows:Record<string,any>[];empty?:string}){
 return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key}>{r[c.key]===null||r[c.key]===undefined?'—':String(r[c.key])}</td>)}</tr>):<tr><td colSpan={columns.length}><Empty>{empty}</Empty></td></tr>}</tbody></table></div>
}
export function AdminNav(){const items=[['/admin','نمای کلی'],['/admin/users','کاربران'],['/admin/roles','نقش‌ها'],['/admin/permissions','مجوزها'],['/admin/tags','برچسب‌ها'],['/admin/custom-fields','فیلدهای سفارشی'],['/admin/scoring','امتیازدهی'],['/admin/notification-rules','قوانین اعلان'],['/admin/integrations','یکپارچه‌سازی'],['/admin/audit','ممیزی'],['/data-quality','کیفیت داده'],['/data-management/import','وارد کردن داده']];return <nav className="subnav" aria-label="مدیریت">{items.map(([href,label])=><Link href={href} key={href}>{label}</Link>)}</nav>}

/* ==========================================================================
   SRIP UI v4 — shared page components
   ========================================================================== */

export type Tone = 'neutral'|'success'|'warning'|'danger'|'info'|'purple';

export function StatusBadge({children,tone='neutral',icon}:{children:React.ReactNode;tone?:Tone;icon?:React.ReactNode}){
  const cls = tone==='neutral'?'chip':`chip ${tone}`;
  return <span className={cls}>{icon}{children}</span>;
}

export function StatCard({icon,label,value,sub,href,iconClass='ic-blue',trend}:{
  icon:React.ReactNode;label:string;value:React.ReactNode;sub?:string;href?:string;iconClass?:string;trend?:{dir:'up'|'down';text:string}
}){
  const body = (<>
    <div className="stat-top">
      <span className={`stat-ico ${iconClass}`}>{icon}</span>
      {trend && <span className={`stat-trend ${trend.dir}`}>{trend.text}</span>}
    </div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </>);
  if (href) return <Link className="stat-card" href={href}>{body}</Link>;
  return <div className="stat-card">{body}</div>;
}

export function SectionCard({title,icon,description,actions,children,className=''}:{
  title:React.ReactNode;icon?:React.ReactNode;description?:React.ReactNode;actions?:React.ReactNode;children:React.ReactNode;className?:string
}){
  return (
    <section className={`section-card ${className}`}>
      <div className="section-head">
        <div>
          <h2>{icon}{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({options,value,onChange,counts}:{
  options:Array<{value:T;label:string}>;value:T;onChange:(v:T)=>void;counts?:Partial<Record<T,number>>
}){
  return (
    <div className="segmented" role="tablist">
      {options.map(o=>(
        <button key={o.value} role="tab" aria-selected={o.value===value} className={o.value===value?'active':''} onClick={()=>onChange(o.value)}>
          {o.label}
          {counts && counts[o.value]!=null && <span className="count">{counts[o.value]}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({children,search,onSearch,searchPlaceholder='جستجو…'}:{
  children?:React.ReactNode;search?:string;onSearch?:(v:string)=>void;searchPlaceholder?:string
}){
  return (
    <div className="page-toolbar">
      {onSearch && (
        <label className="toolbar-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input value={search} onChange={e=>onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder}/>
        </label>
      )}
      {children}
    </div>
  );
}

export function Skeleton({lines=3,card=false}:{lines?:number;card?:boolean}){
  if (card) return <div className="skeleton skeleton-card" aria-hidden="true"/>;
  return (
    <div className="skeleton-stack" aria-hidden="true" style={{display:'flex',flexDirection:'column',gap:10}}>
      {Array.from({length:lines}).map((_,i)=><div key={i} className="skeleton skeleton-line" style={{width:`${100 - i*14}%`}}/>)}
    </div>
  );
}

export function Modal({open,title,description,onClose,children,footer}:{
  open:boolean;title:string;description?:string;onClose:()=>void;children:React.ReactNode;footer?:React.ReactNode
}){
  useEffect(()=>{
    if(!open) return;
    const onKey=(e:KeyboardEvent)=>{ if(e.key==='Escape') onClose(); };
    document.addEventListener('keydown',onKey);
    document.body.style.overflow='hidden';
    return ()=>{ document.removeEventListener('keydown',onKey); document.body.style.overflow=''; };
  },[open,onClose]);
  if(!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-head">
          <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
          <button className="modal-close" onClick={onClose} aria-label="بستن"><X size={16}/></button>
        </div>
        {children}
        {footer && <div className="form-actions">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyV4({icon,title,description,action}:{icon?:React.ReactNode;title:string;description?:string;action?:React.ReactNode}){
  return (
    <div className="empty-state-v4">
      <div className="empty-ico">{icon}</div>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function formatDate(v?:string|null, withTime=false){
  if(!v) return '—';
  const d=new Date(v);
  if(isNaN(d.getTime())) return String(v);
  try{
    return withTime ? d.toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'}) : d.toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'});
  }catch{ return d.toLocaleDateString(); }
}

export function formatRelative(v?:string|null){
  if(!v) return '—';
  const d=new Date(v).getTime();
  if(isNaN(d)) return String(v);
  const diff=Date.now()-d;
  const m=Math.round(diff/60000);
  if(m<1) return 'همین حالا';
  if(m<60) return `${m} دقیقه پیش`;
  const h=Math.round(m/60);
  if(h<24) return `${h} ساعت پیش`;
  const days=Math.round(h/24);
  if(days<30) return `${days} روز پیش`;
  return formatDate(v);
}
