import { enqueueMutation } from './offline-queue';
export const API_BASE_URL=process.env.EXPO_PUBLIC_API_URL??'http://localhost:4000/api/v1';
export async function apiRequest<T>(path:string,options:RequestInit={},token?:string|null):Promise<T>{const headers=new Headers(options.headers);headers.set('Accept','application/json');if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');if(token)headers.set('Authorization',`Bearer ${token}`);const response=await fetch(`${API_BASE_URL}${path}`,{...options,headers});if(!response.ok){let message=`API request failed: ${response.status}`;try{const body=await response.json();message=body?.message??message}catch{}throw new Error(message)}return response.status===204?(undefined as T):await response.json() as T;}
export const apiGet=<T>(path:string,token?:string|null)=>apiRequest<T>(path,{},token);
export const apiPost=<T>(path:string,body:unknown,token?:string|null)=>apiRequest<T>(path,{method:'POST',body:JSON.stringify(body)},token);
export const apiPatch=<T>(path:string,body:unknown,token?:string|null)=>apiRequest<T>(path,{method:'PATCH',body:JSON.stringify(body)},token);
export const api=<T>(path:string,options:RequestInit={},token?:string|null)=>apiRequest<T>(path,options,token);
export async function apiPostOffline<T>(path:string,body:unknown,token?:string|null){try{return await apiPost<T>(path,body,token)}catch(e){await enqueueMutation({path,method:'POST',body});return {queued:true} as T}}
export async function apiPatchOffline<T>(path:string,body:unknown,token?:string|null){try{return await apiPatch<T>(path,body,token)}catch(e){await enqueueMutation({path,method:'PATCH',body});return {queued:true} as T}}
