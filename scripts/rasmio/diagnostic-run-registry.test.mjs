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
test('a stale default index cannot roll back newer code or data during legacy output finalization',async()=>{
 const {execFileSync}=await import('node:child_process');const {synchronizePublishedCheckout}=await import('./diagnostic-run-registry.mjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'published-checkout-test-'));
 const git=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(['init','-q','-b','arena/01a08a50-srip']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);
  fs.mkdirSync(path.join(dir,'out'));fs.mkdirSync(path.join(dir,'data'));fs.writeFileSync(path.join(dir,'code.mjs'),'old');fs.writeFileSync(path.join(dir,'data','obsolete.json'),'old removed data');git(['add','.']);git(['commit','-qm','old checkout']);const old=git(['rev-parse','HEAD']);
  fs.writeFileSync(path.join(dir,'code.mjs'),'new');fs.rmSync(path.join(dir,'data','obsolete.json'));fs.writeFileSync(path.join(dir,'data','new.json'),'new remote data');git(['add','.']);git(['commit','-qm','new published code and data']);const latest=git(['rev-parse','HEAD']);
  git(['read-tree',old]);fs.writeFileSync(path.join(dir,'code.mjs'),'old');fs.rmSync(path.join(dir,'data','new.json'));fs.writeFileSync(path.join(dir,'data','obsolete.json'),'old removed data');
  assert.ok(git(['diff','--cached','--name-only','HEAD']).includes('code.mjs'));
  assert.equal(synchronizePublishedCheckout(latest,{hosted:true,run:git}),true);
  fs.writeFileSync(path.join(dir,'out','result.json'),'new result');git(['add','-f','out','data']);git(['commit','-qm','legacy workflow finalization']);
  assert.equal(git(['ls-files','data/obsolete.json']),'');assert.equal(fs.existsSync(path.join(dir,'data','obsolete.json')),false);assert.equal(git(['show','HEAD:code.mjs']),'new');assert.equal(git(['show','HEAD:data/new.json']),'new remote data');
  assert.equal(git(['show','HEAD:out/result.json']),'new result');assert.equal(synchronizePublishedCheckout(latest,{hosted:false,run:()=>{throw Error('must not touch user checkout');}}),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
