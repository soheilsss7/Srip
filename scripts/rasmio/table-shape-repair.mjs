import fs from 'node:fs';import path from 'node:path';import {hasAlignedTableColumns} from './table-extractor.mjs';
export function requeueMalformedTables(frontier,directory,out){
 frontier.visited||={};frontier.pending||=[];
 const reports=fs.readdirSync(out).filter(f=>/^production-readback-\d+\.json$/.test(f)).sort((a,b)=>Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0])).slice(0,20);
 const keys=new Set();for(const file of reports){try{const report=JSON.parse(fs.readFileSync(path.join(out,file),'utf8'));for(const r of report.records||[])if((r.errors||[]).includes('table column width mismatch')&&/^(company:\d{11}|person:[a-fA-F0-9]+|product:\d+|brand:\d+|patent:\d+)$/.test(r.key))keys.add(r.key);}catch{}}
 const reopened=[];for(const key of keys){try{const [type,id]=key.split(':'),record=JSON.parse(fs.readFileSync(path.join(directory,`${type}-${id}.json`),'utf8'));if(hasAlignedTableColumns(record))continue;delete frontier.visited[key];reopened.push({type,id});}catch{}}
 const pending=new Set((frontier.pending||[]).map(e=>`${e.type}:${e.id}`));for(const e of reopened)if(!pending.has(`${e.type}:${e.id}`)){frontier.pending.unshift(e);pending.add(`${e.type}:${e.id}`);}
 return {reopened:reopened.length,keys:reopened.map(e=>`${e.type}:${e.id}`),previousDataPreserved:true};
}
