// A verified HTTPS transport for Chromium, NOT a certificate-error override.
// Every origin byte is fetched by curl with the OS-root-validated issuer bundle.
import fs from 'node:fs';import path from 'node:path';
export function approvedOriginURL(value){try{const u=new URL(value);return u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!u.username&&!u.password&&!u.port;}catch{return false;}}
export function responseHeaders(text){
 const blocks=text.trim().split(/\r?\n\r?\n/).filter(b=>/^HTTP\//.test(b));const last=blocks.at(-1)||'';const status=Number(last.match(/^HTTP\/\S+\s+(\d{3})/)?.[1]);if(!status)throw new Error('Missing HTTP status');
 const headers={};for(const line of last.split(/\r?\n/).slice(1)){const n=line.indexOf(':');if(n<1)continue;const key=line.slice(0,n).toLowerCase(),value=line.slice(n+1).trim();if(['content-length','content-encoding','transfer-encoding','connection'].includes(key))continue;if(key==='set-cookie'){headers[key]??=[];headers[key].push(value);}else headers[key]=value;}return {status,headers};
}
export function createVerifiedCurlTransport({proxy,bundle,scratch,env,execute,maxRequests=80}){
 const controller=new AbortController(),pending=new Set(),queue=[];let active=0,count=0,closed=false,denied=false;const outcomes=[];
 const acquire=async()=>{if(active>=4)await new Promise(r=>queue.push(r));active++;};const release=()=>{active--;queue.shift()?.();};
 const handle=async request=>{
  const id=++count;if(closed||denied||id>maxRequests||!approvedOriginURL(request.url())||!['GET','POST','HEAD'].includes(request.method())){try{await request.abort();}catch{}return;}
  await acquire();const base=path.join(scratch,`verified-browser-${id}`);const result={path:new URL(request.url()).pathname,method:request.method()};outcomes.push(result);
  try{
   if(closed||denied)throw new Error('Transport stopped');
   const args=['-q','--silent','--show-error','--fail-with-body','--proxy',proxy,'--noproxy','','--cacert',bundle,'--proto','=https','--max-redirs','0','--connect-timeout','5','--max-time','20','--max-filesize','4000000','--compressed','--user-agent','SripPublicSourceAssessment/1.0','--request',request.method(),'--dump-header',base+'.headers','--output',base+'.body'];
   for(const [k,v] of Object.entries(request.headers()))if(!k.startsWith(':')&&!['host','content-length','accept-encoding','connection','user-agent'].includes(k.toLowerCase()))args.push('--header',`${k}: ${v}`);
   if(request.method()==='POST'){fs.writeFileSync(base+'.post',request.postData()||'');args.push('--data-binary','@'+base+'.post');}args.push(request.url());
   try{await execute('curl',args,{env,cwd:scratch,timeout:22000,maxBuffer:100000,signal:controller.signal});}catch(e){if(e.code!==22||!fs.existsSync(base+'.headers')||!fs.existsSync(base+'.body'))throw e;const h=responseHeaders(fs.readFileSync(base+'.headers','utf8'));if(h.status<400)throw e;}
   const {status,headers}=responseHeaders(fs.readFileSync(base+'.headers','utf8'));result.status=status;if([401,403,429].includes(status))denied=true;
   const body=fs.readFileSync(base+'.body');if(body.length>4000000)throw new Error('Response exceeds bound');result.bytes=body.length;if(status>=400&&body.length<1024)result.errorBodyPreview=body.toString('utf8').replace(/<[^>]*>/g,' ').replace(/\d{10,}/g,'[redacted]').slice(0,160);
   if(!request.isInterceptResolutionHandled())await request.respond({status,headers,body});
  }catch(e){result.error=String(e.stderr||(e.name==='AbortError'?'Transport stopped':'Verified HTTPS request failed')).slice(0,180);try{if(!request.isInterceptResolutionHandled())await request.abort();}catch{}}
  finally{for(const ext of ['.headers','.body','.post'])fs.rmSync(base+ext,{force:true});release();}
 };
 return {handle(request){const work=handle(request);pending.add(work);work.finally(()=>pending.delete(work));return work;},get report(){return {tlsValidationDisabled:false,httpsVerifiedBy:'curl with issuer chained to existing OS roots',requests:count,stoppedOnAccessDenial:denied,outcomes};},async close(){closed=true;controller.abort();await Promise.allSettled([...pending]);}};
}
