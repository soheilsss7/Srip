'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useWorkspace} from './workspace';
type Cmd={label:string;hint:string;href:string;permission:string};
const commands:Cmd[]=[
 {label:'داشبورد',hint:'Executive',href:'/',permission:'analytics.read'},
 {label:'سازمان‌ها',hint:'Organizations',href:'/organizations',permission:'org.read'},
 {label:'اشخاص',hint:'People',href:'/people',permission:'person.read'},
 {label:'ارتباطات',hint:'Relationships',href:'/relationships',permission:'relationship.read'},
 {label:'جلسات',hint:'Meetings',href:'/meetings',permission:'meeting.read'},
 {label:'تعهدات',hint:'Commitments',href:'/commitments',permission:'commitment.read'},
 {label:'اقدامات',hint:'Actions',href:'/actions',permission:'action.read'},
 {label:'پروژه‌ها',hint:'Projects',href:'/projects',permission:'project.read'},
 {label:'فرصت‌ها',hint:'Opportunities',href:'/opportunities',permission:'opportunity.read'},
 {label:'شبکه',hint:'Network',href:'/network',permission:'network.read'},
 {label:'جستجو',hint:'Global Search',href:'/search',permission:'search.read'},
 {label:'گزارش‌ها',hint:'Reporting',href:'/reports',permission:'report.read'},
 {label:'اعلان‌ها',hint:'Notifications',href:'/notifications',permission:'entity.read'},
 {label:'مدیریت',hint:'Administration',href:'/admin',permission:'enterprise.admin'},
];
export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
 const [q,setQ]=useState('');const router=useRouter();const {can}=useWorkspace();
 useEffect(()=>{if(!open)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 const list=useMemo(()=>commands.filter(x=>can(x.permission)&&(x.label+' '+x.hint).toLowerCase().includes(q.toLowerCase())),[q,can]);
 useEffect(()=>{if(!open)setQ('');},[open]);
 if(!open)return null;
 return <div className="command-overlay" role="dialog" aria-modal="true"><div className="command-card"><div className="command-input"><span>⌘K</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجوی صفحه، ماژول یا عملیات…"/></div><div className="command-list">{list.length?list.map(x=><button key={x.href} onClick={()=>{onClose();router.push(x.href)}}><b>{x.label}</b><small>{x.hint}</small><span>↵</span></button>):<p className="empty-state">نتیجه‌ای برای این مجوز پیدا نشد.</p>}</div><footer>Esc برای بستن</footer></div></div>
}
