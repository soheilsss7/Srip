import * as SecureStore from 'expo-secure-store';

export type QueuedMutation = { id: string; path: string; method: 'POST'|'PATCH'|'DELETE'; body?: unknown; createdAt: string; attempts: number };
const KEY='srip.offline.mutations';
async function read():Promise<QueuedMutation[]>{ try{return JSON.parse((await SecureStore.getItemAsync(KEY))||'[]')}catch{return[]} }
async function write(items:QueuedMutation[]){await SecureStore.setItemAsync(KEY,JSON.stringify(items));}
export async function enqueueMutation(m:Omit<QueuedMutation,'id'|'createdAt'|'attempts'>){const items=await read();items.push({...m,id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),attempts:0});await write(items);return items.length;}
export async function queuedMutations(){return read();}
export async function flushMutations(send:(m:QueuedMutation)=>Promise<void>){const items=await read();const remaining:QueuedMutation[]=[];for(const item of items){try{await send(item)}catch{remaining.push({...item,attempts:item.attempts+1})}}await write(remaining);return {sent:items.length-remaining.length,remaining:remaining.length};}
export async function clearQueue(){await write([])}
