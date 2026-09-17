'use client';
import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import { t } from '../_lib/i18n';
type Cmd={label:string;hint:string;href:string;keys?:string[]};
const commands:Cmd[]= lt([
 {label:t('داشبورد'),hint:t('مدیریت ارشد'),href:'/'},{label:t('سازمان‌ها'),hint:t('سازمان‌ها'),href:'/organizations'},
 {label:t('اشخاص'),hint:t('اشخاص'),href:'/people'},{label:t('ارتباطات'),hint:t('روابط'),href:'/relationships'},
 {label:t('جلسات'),hint:t('جلسات'),href:'/meetings'},{label:t('تعهدات'),hint:t('تعهدات'),href:'/commitments'},
 {label:t('اقدامات'),hint:t('اقدامات'),href:'/actions'},{label:t('پروژه‌ها'),hint:t('پروژه‌ها'),href:'/projects'},
 {label:t('فرصت‌ها'),hint:t('فرصت‌ها'),href:'/opportunities'},{label:t('شبکه'),hint:t('شبکه'),href:'/network'},
 {label:t('جستجو'),hint:t('جستجوی سراسری'),href:'/search'},{label:t('گزارش‌ها'),hint:t('گزارش‌ها'),href:'/reports'},
 {label:t('اعلان‌ها'),hint:t('اعلان‌ها'),href:'/notifications'},{label:t('مدیریت'),hint:t('مدیریت'),href:'/admin'},
]);
export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
 const [q,setQ]=useState('');const router=useRouter();
 useEffect(()=>{if(!open)return;const f=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',f);return()=>window.removeEventListener('keydown',f)},[open,onClose]);
 useEffect(()=>{if(!open)return;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=''}},[open]);
 const list=useMemo(()=>commands.filter(x=>(x.label+' '+x.hint).toLowerCase().includes(q.toLowerCase())),[q]);
 if(!open)return null;
 return <div className="command-overlay" role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="command-card"><div className="command-input"><span>⌘K</span><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={t('جستجوی صفحه، ماژول یا عملیات…')}/></div><div className="command-list">{list.map(x=><button key={x.href} onClick={()=>{onClose();router.push(x.href)}}><b>{x.label}</b><small>{x.hint}</small><span>↵</span></button>)}</div><footer>{t('Esc برای بستن')}</footer></div></div>
}