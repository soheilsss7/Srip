'use client';
import {useState} from 'react';
import {apiPost} from '../../_lib/api';
import {ErrorCard,PageHeader} from '../../_components/page-ui';
export default function AdminSessions(){
 const [userId,setUserId]=useState(''),[sessionId,setSessionId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function revoke(e:React.FormEvent){e.preventDefault();setError('');setOk('');setBusy(true);try{await apiPost(`/sessions/admin/${encodeURIComponent(userId.trim())}/${encodeURIComponent(sessionId.trim())}/revoke`,{});setOk('نشست با موفقیت Revoke شد.');setSessionId('');}catch(x){setError((x as Error).message)}finally{setBusy(false)}}
 return <main className="feature-page"><PageHeader eyebrow="ADMIN / SESSIONS" title="Session Governance" description="Revoke مدیریتی نشست (session) هر کاربر با شناسه کاربر و شناسه نشست. نیازمند مجوز session.admin.revoke — داده حساس نشست در UI نمایش داده نمی‌شود."/><ErrorCard message={error}/>{ok&&<p style={{color:'var(--srip-success)',margin:'12px 0'}}>{ok}</p>}<section className="panel"><h2>Revoke مدیریتی نشست</h2><form className="entity-form" onSubmit={revoke}><label>شناسه کاربر (userId)<input value={userId} onChange={e=>setUserId(e.target.value)} required placeholder="uuid کاربر"/></label><label>شناسه نشست (sessionId)<input value={sessionId} onChange={e=>setSessionId(e.target.value)} required placeholder="uuid نشست"/></label><button className="primary-action danger" type="submit" disabled={busy}>{busy?'در حال Revoke…':'Revoke نشست'}</button></form></section></main>;
}
