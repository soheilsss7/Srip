// Keep isolated source diagnostics from occupying production crawler writer slots.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const branch='arena/01a08a50-srip';
const modes=new Set(['public-proxy-probe','public-proxy-repair-sample','linka-probe','rrk-probe','rrk-route-probe','rrk-archive-probe','rrk-regional-probe','rrk-vantage-probe']);
export function validDiagnosticRecord(record,runId){return /^\d+$/.test(String(runId))&&record?.runId===String(runId)&&modes.has(record.mode)&&record.productionWriter===false;}
const git=(args,env=process.env)=>execFileSync('git',args,{env,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']}).trim();
export function isRegisteredDiagnosticRun(runId,{localDir='out/diagnostic-runs',readGit}={}){
 if(!/^\d+$/.test(String(runId)))return false;
 const parse=text=>{try{return validDiagnosticRecord(JSON.parse(text),runId);}catch{return false;}};
 try{if(parse(fs.readFileSync(path.join(localDir,`${runId}.json`),'utf8')))return true;}catch{}
 try{return parse(readGit?readGit(runId):git(['show',`origin/${branch}:scripts/rasmio/out/diagnostic-runs/${runId}.json`]));}catch{return false;}
}
export function registerDiagnosticRun(mode,runId){
 if(!validDiagnosticRecord({runId:String(runId),mode,productionWriter:false},runId))throw new Error('Invalid diagnostic registration');
 const file=`out/diagnostic-runs/${runId}.json`;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({runId:String(runId),mode,productionWriter:false,startedAt:new Date().toISOString()},null,2));
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'diagnostic-registry-'));
 try{
  git(['config','user.name','rasmio-bot']);git(['config','user.email','actions@users.noreply.github.com']);
  for(let attempt=0;attempt<3;attempt++){
   git(['fetch','origin',branch]);const parent=git(['rev-parse','FETCH_HEAD']);const env={...process.env,GIT_INDEX_FILE:path.join(scratch,'index')};
   git(['read-tree',parent],env);git(['add','-f','--',file],env);const tree=git(['write-tree'],env);const commit=git(['commit-tree',tree,'-p',parent,'-m',`Register isolated diagnostic ${runId}`],env);git(['update-ref',`refs/heads/${branch}`,commit]);
   try{git(['push','origin',branch]);synchronizePublishedCheckout(commit);return;}catch{if(attempt===2)throw new Error('Diagnostic registration publication failed');}
  }
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}

export function synchronizePublishedCheckout(commit,{hosted=process.env.GITHUB_ACTIONS==='true',run=git}={}){
 // Never rewrite the agent/user checkout. Only refresh our disposable hosted runner
 // after all intended outputs have already been committed and pushed.
 if(!hosted)return false;
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid published Git commit');
 run(['restore',`--source=${commit}`,'--staged','--worktree','--',':/']);
 return true;
}
