// Keep browser requests same-origin by default. Next.js proxies /api/v1 to the
// private API service; an absolute URL is still supported for production setups
// that intentionally expose the API on a separate origin.
export const API=process.env.NEXT_PUBLIC_API_URL??'/api/v1';

export type ApiErrorShape={code?:string;message?:string;requestId?:string;details?:unknown};
export type ApiOptions=RequestInit&{idempotencyKey?:string;timeoutMs?:number};
export class ApiError extends Error{
  code?:string; requestId?:string; details?:unknown; status:number;
  constructor(message:string,status:number,body?:ApiErrorShape){
    super(message); this.name='ApiError'; this.status=status;
    this.code=body?.code; this.requestId=body?.requestId; this.details=body?.details;
  }
}
const ACCESS_KEY='srip_access_token';
const REFRESH_KEY='srip_refresh_token';
const SCOPE_KEY='srip_scope';
const MAX_ERROR_BYTES=64*1024;
let memoryAccessToken:string|null=null;
let refreshPromise:Promise<string|null>|null=null;

export function getAccessToken(){return typeof window==='undefined'?memoryAccessToken:memoryAccessToken??sessionStorage.getItem(ACCESS_KEY);}
const SESSION_EVENT='srip:session';
export function setSession(tokens:{accessToken:string;refreshToken?:string}){
  if(!tokens.accessToken) throw new Error('Authentication response has no access token.');
  memoryAccessToken=tokens.accessToken;
  if(typeof window!=='undefined'){
    sessionStorage.setItem(ACCESS_KEY,tokens.accessToken);
    if(tokens.refreshToken) sessionStorage.setItem(REFRESH_KEY,tokens.refreshToken);
    try{window.dispatchEvent(new Event(SESSION_EVENT));}catch{}
  }
}
export function clearSession(){
  memoryAccessToken=null;
  if(typeof window!=='undefined'){
    sessionStorage.removeItem(ACCESS_KEY);sessionStorage.removeItem(REFRESH_KEY);localStorage.removeItem(SCOPE_KEY);
    try{window.dispatchEvent(new Event(SESSION_EVENT));}catch{}
  }
}
export function getRefreshToken(){return typeof window==='undefined'?null:sessionStorage.getItem(REFRESH_KEY);}
export function setScope(scope:string){if(typeof window!=='undefined')localStorage.setItem(SCOPE_KEY,scope);}
export function getScope(){return typeof window==='undefined'?'all':localStorage.getItem(SCOPE_KEY)??'all';}

function requestId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function messageOf(body:any,status:number){
  if(body?.error?.message)return String(body.error.message);
  if(Array.isArray(body?.message))return body.message.join('، ');
  if(body?.message)return String(body.message);
  if(typeof body?.error==='string')return body.error;
  return `خطای سرور (${status})`;
}
async function readBody(response:Response){
  if(response.status===204)return null;
  const type=response.headers.get('content-type')||'';
  if(!type.includes('application/json'))return response.text().catch(()=>null);
  const len=Number(response.headers.get('content-length')||0);
  if(len>MAX_ERROR_BYTES)return {error:{code:'RESPONSE_TOO_LARGE',message:'پاسخ خطا بیش از حد مجاز است.'}};
  return response.json().catch(()=>null);
}
async function raw(path:string,init:ApiOptions={},token?:string){
  const headers=new Headers(init.headers);
  const isForm=typeof FormData!=='undefined'&&init.body instanceof FormData;
  if(!isForm&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
  if(token&&!headers.has('Authorization'))headers.set('Authorization',`Bearer ${token}`);
  if(!headers.has('X-Request-ID'))headers.set('X-Request-ID',requestId());
  const reqMethod=(init.method??'GET').toUpperCase();
  const retrySensitive=/^(POST|PUT|PATCH|DELETE)$/.test(reqMethod)||/\/reports\/[^/]+\/export\/[^/]+$/.test(path);
  if(retrySensitive&&!headers.has('Idempotency-Key'))headers.set('Idempotency-Key',init.idempotencyKey??requestId());
  const timeoutMs=init.timeoutMs??30000;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  if(init.signal){
    if(init.signal.aborted)controller.abort();
    else init.signal.addEventListener('abort',()=>controller.abort(),{once:true});
  }
  try{return await fetch(`${API}${path}`,{...init,headers,signal:controller.signal,cache:'no-store'});}
  finally{clearTimeout(timeout);}
}
async function refreshAccessToken():Promise<string|null>{
  const refresh=getRefreshToken();if(!refresh)return null;
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    try{
      const r=await raw('/auth/refresh',{method:'POST',body:JSON.stringify({token:refresh}),timeoutMs:15000});
      const d:any=await readBody(r);
      if(!r.ok||!d?.accessToken){clearSession();return null;}
      setSession({accessToken:d.accessToken,refreshToken:d.refreshToken});return d.accessToken;
    }catch{clearSession();return null}
    finally{refreshPromise=null;}
  })();
  return refreshPromise;
}
export async function api<T=unknown>(path:string,init:ApiOptions={}):Promise<T>{
  let response=await raw(path,init,getAccessToken()??undefined);
  if(response.status===401&&!path.startsWith('/auth/')){
    const next=await refreshAccessToken();if(next)response=await raw(path,init,next);
  }
  const body:any=await readBody(response);
  if(response.status===401&&path!=='/auth/login'){
    clearSession();
    if(typeof window!=='undefined'&&!location.pathname.startsWith('/login'))location.assign('/login');
    throw new ApiError('نشست شما منقضی شده است.',401,body?.error??body);
  }
  if(!response.ok)throw new ApiError(messageOf(body,response.status),response.status,body?.error??body);
  return body as T;
}
export async function apiBlob(path:string,init:ApiOptions={}):Promise<Blob>{
  let response=await raw(path,init,getAccessToken()??undefined);
  if(response.status===401){const next=await refreshAccessToken();if(next)response=await raw(path,init,next);}
  if(!response.ok){
    const body=await readBody(response);
    if(response.status===401){clearSession();if(typeof window!=='undefined')location.assign('/login');}
    throw new ApiError(messageOf(body,response.status),response.status,body?.error??body);
  }
  return response.blob();
}
export async function apiUpload<T=unknown>(path:string,file:File,field='file',extra:Record<string,string>={}){
  const allowed=new Set(['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf','image/png','image/jpeg','image/webp']);
  if(file.size>25*1024*1024)throw new ApiError('حجم فایل بیش از 25MB است.',413);
  if(file.type&&!allowed.has(file.type)&&!/\.(csv|xls|xlsx|pdf|png|jpe?g|webp)$/i.test(file.name))throw new ApiError('نوع فایل مجاز نیست.',415);
  const form=new FormData();form.append(field,file);Object.entries(extra).forEach(([k,v])=>form.append(k,v));
  return api<T>(path,{method:'POST',body:form});
}
export const apiGet=<T=unknown>(path:string,init:ApiOptions={})=>api<T>(path,{...init,method:'GET'});
export const apiPost=<T=unknown>(path:string,body:unknown,opts:ApiOptions={})=>api<T>(path,{...opts,method:'POST',body:JSON.stringify(body)});
export const apiPatch=<T=unknown>(path:string,body:unknown,opts:ApiOptions={})=>api<T>(path,{...opts,method:'PATCH',body:JSON.stringify(body)});
export const apiDelete=<T=unknown>(path:string,opts:ApiOptions={})=>api<T>(path,{...opts,method:'DELETE'});
export function unwrapList<T=unknown>(value:any):T[]{ if(Array.isArray(value))return value as T[]; if(value&&value.items!==undefined&&Array.isArray(value.items))return value.items as T[]; if(value&&value.rows!==undefined&&Array.isArray(value.rows))return value.rows as T[]; if(value&&value.data!==undefined&&Array.isArray(value.data))return value.data as T[]; return []; }
export function docsOrigin(){return API.replace(/\/api\/v1\/?$/,'');}
export async function apiDocsJson(){
  const docsUrl=API.startsWith('/')?'/docs-json':`${docsOrigin()}/docs-json`;
  const r=await fetch(docsUrl,{cache:'no-store'});
  if(!r.ok)throw new ApiError(`GET /docs-json → ${r.status}`,r.status);
  return r.json();
}
