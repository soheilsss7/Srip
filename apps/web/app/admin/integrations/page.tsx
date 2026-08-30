'use client';
import{useEffect,useState}from'react';
import{api}from'../../_lib/api';
import{AdminNav,DataTable,Empty,ErrorCard,PageHeader}from'../../_components/page-ui';
import{useWorkspace}from'../../_components/workspace';

export default function Integrations(){
 const {can}=useWorkspace();
 const allowed=can('enterprise.admin');
 const[r,setR]=useState<any[]>([]),[e,setE]=useState('');
 useEffect(()=>{if(!allowed)return;api<any[]>('/admin/integrations').then(v=>setR(Array.isArray(v)?v:(v as {integrations?:unknown[]}).integrations??[])).catch(x=>setE(x.message))},[allowed]);
 if(!allowed)return <main className="feature-page"><PageHeader eyebrow="INTEGRATIONS" title="Integrations" description="وضعیت اتصال سرویس‌های سازمانی."/><section className="panel"><Empty>مجوز مدیریت یکپارچه‌سازی‌های سازمانی برای شما فعال نیست.</Empty></section></main>;
 return <main className="admin-layout"><PageHeader eyebrow="INTEGRATIONS" title="Integrations" description="وضعیت اتصال سرویس‌های سازمانی؛ Secretها در UI نمایش داده نمی‌شوند."/><AdminNav/><ErrorCard message={e}/><DataTable columns={[{key:'provider',label:'Provider'},{key:'kind',label:'Type'},{key:'status',label:'Status'},{key:'organizationId',label:'Organization'}]} rows={r}/></main>
}
