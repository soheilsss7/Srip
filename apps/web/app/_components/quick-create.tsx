'use client';
import {useState} from 'react';
import {api} from '../_lib/api';
type Entity={key:string;label:string;endpoint:string;fields:{name:string;label:string;type?:string;required?:boolean}[]};
const entities:Entity[]=[
 {key:'organization',label:'سازمان',endpoint:'/organizations',fields:[{name:'name',label:'نام',required:true},{name:'type',label:'نوع'}]},
{key:'person',label:'شخص',endpoint:'/people',fields:[{name:'firstName',label:'نام',required:true},{name:'lastName',label:'نام خانوادگی',required:true},{name:'organizationId',label:'Organization ID',required:true},{name:'email',label:'ایمیل',type:'email'}]},
  {key:'relationship',label:'ارتباط',endpoint:'/relationships',fields:[{name:'sourceOrganizationId',label:'Source Organization ID',required:true},{name:'targetOrganizationId',label:'Target Organization ID',required:true},{name:'relationshipType',label:'نوع ارتباط',required:true}]},
  {key:'meeting',label:'جلسه',endpoint:'/meetings',fields:[{name:'title',label:'عنوان',required:true},{name:'startAt',label:'شروع',type:'datetime-local',required:true},{name:'endAt',label:'پایان',type:'datetime-local'}]},
  {key:'action',label:'اقدام',endpoint:'/actions',fields:[{name:'title',label:'عنوان',required:true},{name:'dueAt',label:'موعد',type:'datetime-local'}]},
  {key:'commitment',label:'تعهد',endpoint:'/commitments',fields:[{name:'description',label:'توضیح',required:true},{name:'dueAt',label:'موعد',type:'datetime-local'}]},
 {key:'project',label:'پروژه',endpoint:'/projects',fields:[{name:'name',label:'نام',required:true},{name:'description',label:'توضیح'}]},
 {key:'opportunity',label:'فرصت',endpoint:'/opportunities',fields:[{name:'name',label:'نام',required:true},{name:'value',label:'ارزش',type:'number'}]},
];
export function QuickCreate({open,onClose}:{open:boolean;onClose:()=>void}){
 const [entity,setEntity]=useState(entities[0]),[v,setV]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 if(!open)return null;
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMsg('');try{const body:any={};entity.fields.forEach(f=>{if(v[f.name])body[f.name]=f.type==='number'?Number(v[f.name]):v[f.name]});await api(entity.endpoint,{method:'POST',body:JSON.stringify(body)});setMsg('با موفقیت ایجاد شد.');setV({})}catch(x){setMsg((x as Error).message)}finally{setBusy(false)}}
 return <div className="quick-overlay"><section className="quick-card"><header><div><span className="eyebrow">QUICK ACTION</span><h2>ایجاد سریع</h2></div><button onClick={onClose}>×</button></header><div className="quick-types">{entities.map(x=><button className={x.key===entity.key?'active':''} onClick={()=>{setEntity(x);setV({})}} key={x.key}>{x.label}</button>)}</div><form className="entity-form" onSubmit={submit}>{entity.fields.map(f=><label key={f.name}>{f.label}<input type={f.type??'text'} required={f.required} value={v[f.name]??''} onChange={e=>setV({...v,[f.name]:e.target.value})}/></label>)}<button className="primary-action" disabled={busy}>{busy?'در حال ثبت…':'ایجاد '+entity.label}</button></form>{msg&&<div className="status-message">{msg}</div>}</section></div>
}