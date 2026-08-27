'use client'; import {useEffect,useState} from 'react'; import {api} from '../_lib/api'; import {Badge,ErrorCard,Loading,PageHeader} from '../_components/page-ui';
const unwrap=(x:any)=>Array.isArray(x)?x:x?.items??x?.rows??x?.data??[];
const DEF_TEMPLATE=JSON.stringify({trigger:{type:'MANUAL'},conditions:[],actions:[{type:'CREATE_NOTIFICATION',title:'Workflow notification',body:'Workflow executed',channel:'IN_APP',priority:'MEDIUM'}]},null,2);
const ACTION_TYPES=['CREATE_NOTIFICATION','CREATE_ACTION','CREATE_COMMITMENT','CREATE_OPPORTUNITY','REQUEST_APPROVAL','WAIT'];
export default function Workflows(){
 const [items,setItems]=useState<any[]>([]),[error,setError]=useState(''),[status,setStatus]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const [name,setName]=useState(''),[entityType,setEntityType]=useState('relationship'),[isActive,setIsActive]=useState(true),[definition,setDefinition]=useState(DEF_TEMPLATE),[showCreate,setShowCreate]=useState(false);
 const [exec,setExec]=useState<Record<string,string>>({}),[ctx,setCtx]=useState<Record<string,string>>({});
 async function load(){setLoading(true);setError('');try{setItems(unwrap(await api('/workflows')))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 function validate(a:any){if(!a||!Array.isArray(a.actions))throw new Error('definition.actions باید آرایه باشد.');for(const act of a.actions)if(!ACTION_TYPES.includes(act?.type))throw new Error(`پشتیبانی نشده: ${act?.type}`);}
 async function createWf(){setBusy('create');setError('');setStatus('');let def;try{def=JSON.parse(definition);validate(def);}catch(e){setError((e as Error).message);setBusy('');return}try{await api('/workflows',{method:'POST',body:JSON.stringify({name:name.trim(),entityType,isActive,definition:def})});setName('');setShowCreate(false);setStatus('Workflow ایجاد شد.');await load()}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 async function executeWf(w:any){const entityId=(exec[w.id]??'').trim();if(!entityId){setError('شناسه موجودیت (entityId) الزامی است.');return}setBusy('run'+w.id);setError('');setStatus('');let context={};try{const raw=(ctx[w.id]??'').trim();if(raw)context=JSON.parse(raw);}catch(e){setError('زمینه (context) JSON معتبر نیست.');setBusy('');return}try{const r:any=await api(`/workflows/${w.id}/execute`,{method:'POST',body:JSON.stringify({entityType:w.entityType,entityId,context,triggerType:'MANUAL'})});setStatus(`اجرا پایان یافت: ${r?.status??'—'}${r?.executionId?` (execution ${r.executionId})`:''}`);}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 const count=(w:any)=>Array.isArray(w?.definition?.actions)?w.definition.actions.length:0;
 const trig=(w:any)=>w?.definition?.trigger?.type??'MANUAL';
 return <main className="feature-page"><PageHeader eyebrow="WORKFLOW AUTOMATION" title="Workflows" description="Triggers، Conditions، Actions (Notification/Action/Commitment/Opportunity/Approval/Wait) و اجرای دستی با Authorization واقعی." actions={<button className="primary-action" onClick={()=>setShowCreate(s=>!s)}>{showCreate?'بستن':'+ Workflow جدید'}</button>}/>
 <ErrorCard message={error}/>{status&&<div className="notice" role="status">{status}</div>}
 {loading?<Loading/>:<>
 {showCreate&&<section className="panel"><div className="panel-title"><div><h2>ایجاد Workflow</h2></div></div>
  <div className="form-grid"><label className="full">نام<input value={name} onChange={e=>setName(e.target.value)} placeholder="نام workflow" required/></label>
  <label>Entity Type<select value={entityType} onChange={e=>setEntityType(e.target.value)}><option value="relationship">relationship</option><option value="meeting">meeting</option><option value="project">project</option><option value="opportunity">opportunity</option><option value="person">person</option><option value="organization">organization</option><option value="recommendation">recommendation</option></select></label>
  <label>فعال<input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)}/></label>
  <label className="full">Definition (JSON)<textarea value={definition} onChange={e=>setDefinition(e.target.value)} className="json-field" style={{minHeight:200,direction:'ltr',textAlign:'left',fontFamily:'monospace'}}/></label>
  <p className="muted full">Actionهای مجاز: {ACTION_TYPES.join('، ')}</p>
  <button className="primary-action" onClick={createWf} disabled={!!busy}>{busy==='create'?'در حال ثبت…':'ایجاد Workflow'}</button></div>
 </section>}
 {items.length===0?<div className="panel"><p className="empty-state">Workflowی تعریف نشده است.</p></div>:<div className="list">{items.map(w=><article className="panel compact" key={w.id}>
  <div className="panel-title"><div><strong>{w.name}</strong><small className="muted">{w.entityType} · Trigger: {trig(w)} · {count(w)} action</small></div><span><Badge tone={w.isActive?'success':'neutral'}>{w.isActive?'Active':'Paused'}</Badge></span></div>
  <div className="toolbar"><input placeholder="شناسه موجودیت (entityId)" value={exec[w.id]??''} onChange={e=>setExec(x=>({...x,[w.id]:e.target.value}))} aria-label="entityId"/><input placeholder='Context JSON (اختیاری) {"k":"v"}' value={ctx[w.id]??''} onChange={e=>setCtx(x=>({...x,[w.id]:e.target.value}))} aria-label="context"/><button className="secondary-action" onClick={()=>executeWf(w)} disabled={!!busy||!w.isActive}>{busy==='run'+w.id?'در حال اجرا…':'اجرای دستی'}</button></div>
  {!w.isActive&&<p className="muted">این Workflow غیرفعال است؛ ابتدا باید تعریف فعال را تغییر دهید.</p>}
 </article>)}</div>}
 </>}</main>}