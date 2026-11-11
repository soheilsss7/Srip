import fs from 'node:fs';import path from 'node:path';import {parseTunnelList} from './user-tunnel-configs.mjs';
export const publicTunnelManifest='data/sources/user-public-tunnels/catalog.json';
export function loadPublicTunnelCatalog(file=publicTunnelManifest){
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.files)||manifest.files.length>100||new Set(manifest.files).size!==manifest.files.length||manifest.files.some(f=>!/^\d{4}-\d{2}-\d{2}\.txt$/.test(f)))throw Error('Invalid public tunnel manifest');
 const result={total:0,accepted:[],rejected:[],duplicates:[],sources:[]},seen=new Map();
 for(const sourceFile of manifest.files){
  const batch=parseTunnelList(fs.readFileSync(path.join(path.dirname(file),sourceFile),'utf8'));result.total+=batch.total;let added=0,crossDuplicates=0;
  result.rejected.push(...batch.rejected.map(v=>({...v,sourceFile})));result.duplicates.push(...batch.duplicates.map(v=>({...v,sourceFile})));
  for(const candidate of batch.accepted){if(seen.has(candidate.id)){result.duplicates.push({sourceFile,line:candidate.line,id:candidate.id.slice(0,16),duplicateSourceFile:seen.get(candidate.id)});crossDuplicates++;continue;}seen.set(candidate.id,sourceFile);result.accepted.push({...candidate,sourceFile});added++;}
  result.sources.push({sourceFile,total:batch.total,acceptedUniqueInBatch:batch.accepted.length,newUniqueAdded:added,rejected:batch.rejected.length,duplicates:batch.duplicates.length+crossDuplicates});
 }
 return result;
}
