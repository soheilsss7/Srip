import {requiresProxy} from './detail-lanes.mjs';
export function recordTransportErrors(record,pool,requests=[]){
 if(requiresProxy(record)){
  const errors=[];
  if(!(record.egress?.directFallback===false&&/^proxy-/.test(record.via)))errors.push('proxy metadata missing');
  if(!pool.outcomes.some(o=>o.key===`${record.type}:${record.id}`&&o.success&&o.observedExitIP===record.egress?.observedExitIP))errors.push('missing successful transport outcome');
  return errors;
 }
 if(!['product','brand','patent','invention'].includes(record.type))return ['unsupported direct record type'];
 let path;try{const u=new URL(record.url);if(u.protocol!=='https:'||u.hostname!=='rasmio.com'||u.port||u.username||u.password)throw Error();path=u.pathname;}catch{return ['invalid direct source URL'];}
 const type=record.type==='invention'?'patent':record.type;
 if(path!==`/${type}/${record.id}/`)return ['direct source identity mismatch'];
 if(record.via!=='fetch-anon'||!requests.some(r=>r.event==='request'&&String(r.runId)===String(record.sourceRun)&&r.path===path&&r.status===200&&r.outcome==='html-with-tables'))return ['missing successful direct HTTPS observation'];
 return [];
}
