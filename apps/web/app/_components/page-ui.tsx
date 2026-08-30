'use client';
import React from 'react';
import {Badge as DSBadge, EmptyState, ErrorState} from '@srip/design-system';
import {useWorkspace} from './workspace';

export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:React.ReactNode}){
 return <header className="page-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="heading-tools">{actions}</div>}</header>
}
export function ErrorCard({message}:{message?:string}){return message?<ErrorState message={message}/>:null}
export function Loading({label='در حال بارگذاری…'}:{label?:string}){return <div className="loading-strip" aria-live="polite">{label}</div>}
export function Empty({children='داده‌ای برای نمایش وجود ندارد.'}){return <EmptyState title="">{children}</EmptyState>}
export function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'success'|'warning'|'danger'|'info'}){return <DSBadge className={`${tone}`}>{children}</DSBadge>}
export function DataTable({columns,rows,empty='داده‌ای وجود ندارد.'}:{columns:{key:string;label:string}[];rows:Record<string,any>[];empty?:string}){
 return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key}>{r[c.key]===null||r[c.key]===undefined?'—':r[c.key]}</td>)}</tr>):<tr><td colSpan={columns.length}><Empty>{empty}</Empty></td></tr>}</tbody></table></div>
}
export function AdminNav(){const{can}=useWorkspace();const items=[['/admin','Overview','enterprise.admin'],['/admin/users','Users','enterprise.admin'],['/admin/roles','Roles','role.manage'],['/admin/permissions','Permissions','enterprise.admin'],['/admin/tags','Tags','enterprise.admin'],['/admin/custom-fields','Custom Fields','enterprise.admin'],['/admin/scoring','Scoring','enterprise.admin'],['/admin/notification-rules','Notification Rules','enterprise.admin'],['/admin/integrations','Integrations','enterprise.admin'],['/admin/audit','Audit','audit.read'],['/data-quality','Data Quality','data.quality.read'],['/data-management/import','Import','data.import']];return <nav className="subnav" aria-label="مدیریت">{items.filter(([, ,permission])=>can(permission)).map(([href,label])=><a href={href} key={href}>{label}</a>)}</nav>}
