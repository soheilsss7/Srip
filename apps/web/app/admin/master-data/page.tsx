'use client';
import {useEffect,useState} from 'react';
import {api} from '../../_lib/api';
import {DataTable,Empty,ErrorCard,Loading,PageHeader} from '../../_components/page-ui';
import {useWorkspace} from '../../_components/workspace';

export default function Page(){
 const {can}=useWorkspace();
 const allowed=can('enterprise.admin');
 const[data,setData]=useState<any>({}),[e,setE]=useState(''),[l,setL]=useState(true);
 useEffect(()=>{if(!allowed){setL(false);return}Promise.all([api('/core-domain/relationship-types'),api('/admin/interaction-types')]).then(([r,i])=>setData({relationshipTypes:r,interactionTypes:i})).catch(x=>setE((x as Error).message)).finally(()=>setL(false))},[allowed]);
 if(!allowed)return <main className="feature-page"><PageHeader eyebrow="ADMIN / MASTER DATA" title="Master Data" description="Reference data مشترک برای Relationship و Interaction."/><section className="panel"><Empty>مجوز مدیریت داده‌های پایه برای شما فعال نیست.</Empty></section></main>;
 return <main className="feature-page"><PageHeader eyebrow="ADMIN / MASTER DATA" title="Master Data" description="Reference data مشترک برای Relationship و Interaction از API واقعی Backend."/><ErrorCard message={e}/>{l?<Loading/>:<div className="dashboard-grid"><section className="panel"><h2>Relationship Types</h2><DataTable columns={[{key:'key',label:'Key'},{key:'name',label:'Name'}]} rows={Array.isArray(data.relationshipTypes)?data.relationshipTypes:[]}/></section><section className="panel"><h2>Interaction Types</h2><DataTable columns={[{key:'key',label:'Key'},{key:'name',label:'Name'}]} rows={Array.isArray(data.interactionTypes)?data.interactionTypes:[]}/></section></div>}</main>
}
