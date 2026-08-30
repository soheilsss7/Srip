'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader,Badge} from '../_components/page-ui';
import {AdminNav} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';
export default function Admin(){
 const {can}=useWorkspace();
 const allowed=can('enterprise.admin');
 const [d,setD]=useState<any>(null),[e,setE]=useState('');
 useEffect(()=>{if(allowed)api('/admin/overview').then(setD).catch(x=>setE(x.message))},[allowed]);
  const cards=[['users','کاربران'],['organizations','سازمان‌ها'],['roles','نقش‌ها'],['permissions','مجوزها'],['tags','Tagها'],['customFields','Custom Fields'],['workflows','Workflowها'],['integrations','Integrationها'],['notificationRules','Notification Rules']];
 if(!allowed)return <main className="feature-page"><PageHeader eyebrow="ENTERPRISE ADMINISTRATION" title="مدیریت سیستم" description="مرکز کنترل‌های سازمانی."/><section className="panel"><p className="empty-state">مجوز مدیریت سیستم برای شما فعال نیست.</p></section></main>;
 return <main className="admin-layout"><PageHeader eyebrow="ENTERPRISE ADMINISTRATION" title="مدیریت سیستم" description="مرکز مدیریت کاربران، نقش‌ها، مجوزها، Master Data، Workflow، Scoring، Notification و Audit."/><AdminNav/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<><section className="stat-row">{cards.map(([k,l])=><div className="stat-box" key={k}><span>{l}</span><strong>{Array.isArray(d?.[k])?d[k].length:d?.[k]??'—'}</strong></div>)}</section><section className="dashboard-grid"><article className="panel"><h2>Governance</h2><div className="priority-list"><a href="/admin/users"><b>Users</b><span>فعال‌سازی و Scope</span></a><a href="/admin/roles"><b>Roles</b><span>RBAC</span></a><a href="/admin/permissions"><b>Permissions</b><span>Permission Matrix</span></a><a href="/admin/audit"><b>Audit</b><span>ردیابی تغییرات</span></a></div></article><article className="panel"><h2>Enterprise Controls</h2><div className="priority-list"><a href="/governance"><b>Governance</b><span>Policy / Export</span></a><a href="/privacy"><b>Privacy</b><span>GDPR / Lifecycle</span></a><a href="/security"><b>Security</b><span>Events / Preflight</span></a><a href="/admin/feature-flags"><b>Feature Flags</b><span>Controlled rollout</span></a></div></article></section></>}</main>
}
