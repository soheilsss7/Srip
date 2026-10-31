import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateRecord,graphFor} from './core.mjs';
export function importBundle(bundle,destination){
 if(bundle.schemaVersion!==1||bundle.source!=='rrk.ir'||!Array.isArray(bundle.records))throw new Error('Unsupported export');
 const incoming=bundle.records.map(validateRecord); // Validate the whole incoming batch before writing.
 const dir=path.join(destination,'announcements');
 fs.mkdirSync(dir,{recursive:true});const all=new Map();
 for(const f of fs.readdirSync(dir).filter(f=>/^[a-f0-9]{64}\.json$/.test(f))){const r=validateRecord(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));all.set(r.recordId,r);}
 for(const r of incoming){const old=all.get(r.recordId);if(old&&old.companyNationalId!==r.companyNationalId)throw new Error('Conflicting company identity; import stopped');}
 let added=0,updated=0,unchanged=0;
 for(const r of incoming){const old=all.get(r.recordId);if(old?.contentHash===r.contentHash){unchanged++;continue;}if(old)updated++;else added++;all.set(r.recordId,r);
  const name=crypto.createHash('sha256').update(r.recordId).digest('hex')+'.json',target=path.join(dir,name);
  fs.writeFileSync(target+'.tmp',JSON.stringify(r,null,2));fs.renameSync(target+'.tmp',target);
 }
 const records=[...all.values()].sort((a,b)=>a.recordId.localeCompare(b.recordId)),graph=graphFor(records);
 fs.writeFileSync(path.join(destination,'graph.json'),JSON.stringify(graph,null,2));
 const summary={source:'rrk.ir',records:records.length,companies:new Set(records.map(r=>r.companyNationalId)).size,personObservations:graph.nodes.filter(n=>n.type==='person-observation').length,relationships:graph.edges.length,added,updated,unchanged,canonicalRasmioProfilesChanged:0,archiveCoverageVerified:false,identityMergesPerformed:0};
 fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(summary,null,2));return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,dest]=process.argv.slice(2);if(!input||!dest)throw new Error('Usage: node import.mjs rrk-export.json DESTINATION');
 console.log(JSON.stringify(importBundle(JSON.parse(fs.readFileSync(input,'utf8')),path.resolve(dest)),null,2));
}
