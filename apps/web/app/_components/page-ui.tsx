'use client';
import React from 'react';

export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:React.ReactNode}){
 return <header className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="heading-tools">{actions}</div>}</header>
}
export function ErrorCard({message}:{message?:string}){return message?<div className="error-card" role="alert">{message}</div>:null}
export function Loading({label='در حال بارگذاری…'}:{label?:string}){return <div className="loading-strip" aria-live="polite">{label}</div>}
export function Empty({children='داده‌ای برای نمایش وجود ندارد.'}){return <div className="empty-state">{children}</div>}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'info'}){return <span className={`ui-badge ${tone}`}>{children}</span>}
export function DataTable({columns,rows,empty='داده‌ای وجود ندارد.'}:{columns:{key:string;label:string}[];rows:Record<string,any>[];empty?:string}){
 return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key}>{r[c.key]===null||r[c.key]===undefined?'—':String(r[c.key])}</td>)}</tr>):<tr><td colSpan={columns.length}><Empty>{empty}</Empty></td></tr>}</tbody></table></div>
}
export function AdminNav(){const items=[['/admin','Overview'],['/admin/users','Users'],['/admin/roles','Roles'],['/admin/permissions','Permissions'],['/admin/tags','Tags'],['/admin/custom-fields','Custom Fields'],['/admin/scoring','Scoring'],['/admin/notification-rules','Notification Rules'],['/admin/integrations','Integrations'],['/admin/audit','Audit'],['/data-quality','Data Quality'],['/data-management/import','Import']];return <nav className="subnav" aria-label="مدیریت">{items.map(([href,label])=><a href={href} key={href}>{label}</a>)}</nav>}
