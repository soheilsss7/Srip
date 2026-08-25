import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPost, API_BASE_URL } from '../services/api-client';
import { flushMutations } from '../services/offline-queue';
import { configureNotificationHandler, registerForPushNotifications } from '../services/push';

type SessionContextValue={token:string|null;loading:boolean;online:boolean;signIn:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>;syncOffline:()=>Promise<{sent:number;remaining:number}>};
const SessionContext=createContext<SessionContextValue|null>(null); const TOKEN_KEY='srip.access_token';
export function SessionProvider({children}:{children:React.ReactNode}){
 const [token,setToken]=useState<string|null>(null); const [loading,setLoading]=useState(true); const [online,setOnline]=useState(true);
 useEffect(()=>{configureNotificationHandler(); SecureStore.getItemAsync(TOKEN_KEY).then(setToken).finally(()=>setLoading(false));},[]);
 const syncOffline=async()=>{if(!token)return {sent:0,remaining:0};return flushMutations(async m=>{const r=await fetch(`${API_BASE_URL}${m.path}`,{method:m.method,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:m.body===undefined?undefined:JSON.stringify(m.body)});if(!r.ok)throw new Error(`queued mutation failed ${r.status}`)})};
 useEffect(()=>{if(!token)return;syncOffline().catch(()=>{}); registerForPushNotifications().catch(()=>{});},[token]);
 const value=useMemo<SessionContextValue>(()=>({token,loading,online,async signIn(email,password){const result=await apiPost<{accessToken?:string;token?:string}>('/auth/login',{email,password});const next=result.accessToken??result.token;if(!next)throw new Error('Authentication response did not contain an access token');await SecureStore.setItemAsync(TOKEN_KEY,next);setToken(next)},async signOut(){if(token){try{await apiPost('/auth/logout',{token},token)}catch{}}await SecureStore.deleteItemAsync(TOKEN_KEY);setToken(null)},syncOffline}),[token,loading,online]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession(){const value=useContext(SessionContext);if(!value)throw new Error('useSession must be used inside SessionProvider');return value;}
