'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
type Cmd={label:string;hint:string;href:string;keys?:string[]};
const commands:Cmd[]=[
 {label:'داشبورد',hint:'Executive',href:'/'},{label:'سازمان‌ها',hint:'Organizations',href:'/organizations'},
 {label:'اشخاص',hint:'People',href:'/people'},{label:'ارتباطات',hint:'Relationships',href:'/relationships'},
 {label:'جلسات',hint:'Meetings',href:'/meetings'},{label:'تعهدات',hint:'Commitments',href:'/commitments'},
 {label:'اقدامات',hint:'Actions',href:'/actions'},{label:'پروژه‌ها',hint:'Projects',href:'/projects'},
 {label:'فرصت‌ها',hint:'Opportunities',href:'/opportunities'},{label:'شبکه',hint:'Network',href:'/network'},
 {label:'جستجو',hint:'Global Search',href:'/search'},{label:'گزارش‌ها',hint:'Reporting',href:'/reports'},
 {label:'اعلان‌ها',hint:'Notifications',href:'/notifications'},{label:'مدیریت',hint:'Administration',href:'/admin'},
];
export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
 const [q,setQ]=useState('');const router=useRouter();
 useEffect(()=>{if(!open)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 const list=useMemo(()=>commands.filter(x=>(x.label+' '+x.hint).toLowerCase().includes(q.toLowerCase())),[q]);
 if(!open)return null;
 return <div className="command-overlay" role="dialog" aria-modal="true"><div className="command-card"><div className="command-input"><span>⌘K</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجوی صفحه، ماژول یا عملیات…"/></div><div className="command-list">{list.map(x=><button key={x.href} onClick={()=>{onClose();router.push(x.href)}}><b>{x.label}</b><small>{x.hint}</small><span>↵</span></button>)}</div><footer>Esc برای بستن</footer></div></div>
}