import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {requeueMalformedTables} from './table-shape-repair.mjs';
test('readback shape failures reopen tasks without deleting or rewriting source records',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shape-repair-'));fs.mkdirSync(path.join(dir,'out'));
 try{const body=JSON.stringify({tables:[{columns:['A','B'],rows:[['one']]}]});fs.writeFileSync(path.join(dir,'product-123.json'),body);fs.writeFileSync(path.join(dir,'out','production-readback-456.json'),JSON.stringify({records:[{key:'product:123',errors:['table column width mismatch']}]}));const f={pending:[],visited:{'product:123':{rows:1}}};assert.equal(requeueMalformedTables(f,dir,path.join(dir,'out')).reopened,1);assert.equal(f.visited['product:123'],undefined);assert.deepEqual(f.pending,[{type:'product',id:'123'}]);requeueMalformedTables(f,dir,path.join(dir,'out'));assert.equal(f.pending.length,1);assert.equal(fs.readFileSync(path.join(dir,'product-123.json'),'utf8'),body);
 fs.writeFileSync(path.join(dir,'product-123.json'),JSON.stringify({tables:[{columns:['A'],rows:[['one']]}]}));assert.equal(requeueMalformedTables(f,dir,path.join(dir,'out')).reopened,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
