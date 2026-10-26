'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
type Cmd={label:string;hint:string;href:string;keys?:string[]};
const commands:Cmd[]=[
 {label:'داشبورد',hint:'مدیریت ارشد',href:'/'},{label:'سازمان‌ها',hint:'سازمان‌ها',href:'/organizations'},
 {label:'اشخاص',hint:'اشخاص',href:'/people'},{label:'ارتباطات',hint:'روابط',href:'/relationships'},
 {label:'جلسات',hint:'جلسات',href:'/meetings'},{label:'تعهدات',hint:'تعهدات',href:'/commitments'},
 {label:'اقدامات',hint:'اقدامات',href:'/actions'},{label:'پروژه‌ها',hint:'پروژه‌ها',href:'/projects'},
 {label:'فرصت‌ها',hint:'فرصت‌ها',href:'/opportunities'},{label:'شبکه',hint:'شبکه',href:'/network'},
 {label:'جستجو',hint:'جستجوی سراسری',href:'/search'},{label:'گزارش‌ها',hint:'گزارش‌ها',href:'/reports'},
 {label:'اعلان‌ها',hint:'اعلان‌ها',href:'/notifications'},{label:'مدیریت',hint:'مدیریت',href:'/admin'},
];
export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
 const [q,setQ]=useState('');const router=useRouter();
 useEffect(()=>{if(!open)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 const list=useMemo(()=>commands.filter(x=>(x.label+' '+x.hint).toLowerCase().includes(q.toLowerCase())),[q]);
 if(!open)return null;
 return <div className="command-overlay" role="dialog" aria-modal="true"><div className="command-card"><div className="command-input"><span>⌘K</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="جستجوی صفحه، ماژول یا عملیات…"/></div><div className="command-list">{list.map(x=><button key={x.href} onClick={()=>{onClose();router.push(x.href)}}><b>{x.label}</b><small>{x.hint}</small><span>↵</span></button>)}</div><footer>Esc برای بستن</footer></div></div>
}