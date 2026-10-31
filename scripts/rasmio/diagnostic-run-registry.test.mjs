import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {validDiagnosticRecord,isRegisteredDiagnosticRun} from './diagnostic-run-registry.mjs';
test('only positively registered diagnostic runs are excluded, never unknown production writers',()=>{
 const doc={runId:'123',mode:'rrk-regional-probe',productionWriter:false};assert.equal(validDiagnosticRecord(doc,'123'),true);
 for(const d of [{...doc,productionWriter:true},{...doc,mode:'normal'},{...doc,runId:'124'}])assert.equal(validDiagnosticRecord(d,'123'),false);
 assert.equal(isRegisteredDiagnosticRun('123',{localDir:'/not-a-real-test-directory',readGit:()=>JSON.stringify(doc)}),true);
 assert.equal(isRegisteredDiagnosticRun('123',{localDir:'/not-a-real-test-directory',readGit:()=>''}),false);
 assert.equal(isRegisteredDiagnosticRun('../123',{readGit:()=>{throw Error('must not be read');}}),false);
});
test('local registry markers are validated against the actual run ID',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'diagnostic-registry-test-'));try{fs.writeFileSync(path.join(d,'123.json'),JSON.stringify({runId:'123',mode:'rrk-archive-probe',productionWriter:false}));assert.equal(isRegisteredDiagnosticRun('123',{localDir:d,readGit:()=>''}),true);assert.equal(isRegisteredDiagnosticRun('124',{localDir:d,readGit:()=>''}),false);}finally{fs.rmSync(d,{recursive:true,force:true});}
});
