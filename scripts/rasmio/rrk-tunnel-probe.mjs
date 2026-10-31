// Bounded test of explicitly published free VMess endpoints, not accounts or diagnostic-service relays.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {createHash} from 'node:crypto';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {prepareCertumChain} from './rrk-certum-chain.mjs';import {prepareNativeIssuerCache} from './rrk-native-issuer-cache.mjs';
import {samplePublicNotices} from './rrk-public-search-sample.mjs';import {redactPersonalNumbers} from '../../tools/rrk-local/core.mjs';
const execute=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const archiveURL='https://github.com/XTLS/Xray-core/releases/download/v26.10.31/Xray-linux-64.zip';
const archiveSHA='e4bd9119f50ae7c41658b1abd0679ae06f98bd864a2907ff33f2f2cf7081b214';
const sourceBlob='8d1e9dacd9ba9cf082474c0258824101c172e3ca';
const target='https://www.rrk.ir/ords/r/rrs/rrs-front/%D8%AF%D8%A7%D8%AF%D9%87-%D8%A8%D8%A7%D8%B2';
export function publicVmessCandidates(text){
 const allowed=new Set(['212.80.8.184','92.42.203.240']),seen=new Set(),result=[];
 for(const [index,line] of text.split(/\r?\n/).entries()){
  if(!line.startsWith('vmess://'))continue;let v;try{v=JSON.parse(Buffer.from(line.slice(8),'base64').toString());}catch{continue;}
  const port=Number(v.port);if(!allowed.has(v.add)||!Number.isInteger(port)||port<1||port>65535||!/^[-a-f0-9]{36}$/i.test(v.id||'')||Number(v.aid||0)!==0||!['tcp','raw'].includes(v.net)||!['','none',undefined].includes(v.tls)||!['auto','aes-128-gcm','chacha20-poly1305',undefined].includes(v.scy))continue;
  const key=`${v.add}:${port}`;if(seen.has(key))continue;seen.add(key);result.push({index,address:v.add,port,id:v.id,security:v.scy||'auto'});
 }return result.slice(0,2);
}
export function xrayConfig(candidate,port){return {log:{loglevel:'none'},inbounds:[{listen:'127.0.0.1',port,protocol:'socks',settings:{auth:'noauth',udp:false}}],outbounds:[{protocol:'vmess',settings:{vnext:[{address:candidate.address,port:candidate.port,users:[{id:candidate.id,alterId:0,security:candidate.security}]}]},streamSettings:{network:'raw',security:'none'}}]};}
export function tunnelArgs(port,url,bundle){if(!Number.isInteger(port)||port<1024||port>65535||!['https://www.rrk.ir/robots.txt',target].includes(url))throw new Error('Unapproved tunnel target');return ['-q','--silent','--show-error','--proxy',`socks5h://127.0.0.1:${port}`,'--noproxy','','--cacert',bundle,'--proto','=https','--max-redirs','0','--connect-timeout','8','--max-time','20','--max-filesize','1500000','--tlsv1.2','--tls-max','1.2','--http1.1','--user-agent','SripPublicSourceAssessment/1.0',url,'--write-out','\n__RRK_META__%{http_code}'];}
async function freePort(){const server=net.createServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const port=server.address().port;await new Promise(r=>server.close(r));return port;}
async function ready(port,child){for(let i=0;i<20;i++){if(child.exitCode!==null)throw new Error('Tunnel client exited before readiness');if(await new Promise(r=>{const s=net.connect({host:'127.0.0.1',port});s.setTimeout(150);s.once('connect',()=>{s.destroy();r(true);});s.once('error',()=>{s.destroy();r(false);});s.once('timeout',()=>{s.destroy();r(false);});}))return;await sleep(100);}throw new Error('Local tunnel listener not ready');}
export async function runRrkTunnelProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,''),file=`out/rrk-tunnel-probe-${runId}.json`,files=[file];fs.mkdirSync('out',{recursive:true});
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rrk-vmess-')),env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'};
 const report={runId,startedAt:new Date().toISOString(),mode:'rrk-public-vmess-routing',source:{repository:'sakha1370/OpenRay',blob:sourceBlob,publisherLabelsCountry:'IR',exitCountryIndependentlyVerified:false},limits:{tunnels:2,browserRequests:80,publicCompanySearches:1,maxNotices:2},attempts:[],verifiedProfiles:[],verifiedExitCount:0,advertsExtracted:0,relationshipsExtracted:0,canonicalRecordsChanged:false,fullCoverageVerified:false,publicKeysExported:false,tlsValidationDisabled:false};
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));let child,browser;save();
 try{
  const source=await fetch(`https://api.github.com/repos/sakha1370/OpenRay/git/blobs/${sourceBlob}`,{signal:AbortSignal.timeout(15000)});if(!source.ok)throw new Error(`Public source provider HTTP ${source.status}`);const blob=await source.json(),text=Buffer.from(blob.content||'','base64').toString();if(text.length>50000)throw new Error('Unexpected source size');const candidates=publicVmessCandidates(text);report.candidateCount=candidates.length;save();if(!candidates.length)throw new Error('No approved published VMess candidates');
  const zip=path.join(scratch,'xray.zip');await execute('curl',['-q','--silent','--show-error','--fail','--location','--proto','=https','--max-redirs','3','--max-time','60','--max-filesize','25000000','--output',zip,archiveURL],{env,timeout:65000,maxBuffer:100000});
  if(createHash('sha256').update(fs.readFileSync(zip)).digest('hex')!==archiveSHA)throw new Error('Public client binary checksum mismatch');
  const binary=path.join(scratch,'xray');const extracted=await execute('unzip',['-p',zip,'xray'],{env,encoding:'buffer',timeout:10000,maxBuffer:64000000});fs.writeFileSync(binary,extracted.stdout,{mode:0o700});report.client={version:'v26.10.31',archiveSHA256:archiveSHA,checksumVerified:true};
  const chain=await prepareCertumChain(scratch,execute,env);report.chainCompletion=chain.evidence;report.nativeIssuerCache=await prepareNativeIssuerCache({scratch,env,execute});
  for(const candidate of candidates){
   const port=await freePort(),config=path.join(scratch,'client.private.json');fs.writeFileSync(config,JSON.stringify(xrayConfig(candidate,port)),{mode:0o600});
   child=spawn(binary,['run','-config',config],{env,stdio:'ignore'});child.on('error',()=>{});await ready(port,child);
   const attempt={sourceIndex:candidate.index,protocol:'vmess-aead',serverAddress:candidate.address,serverPort:candidate.port,at:new Date().toISOString()};report.attempts.push(attempt);save();let admitted=false,denied=false;
   for(const url of ['https://www.rrk.ir/robots.txt',target]){
    if(url===target&&!admitted)break;const record={url};(attempt.requests??=[]).push(record);let stdout='';try{({stdout}=await execute('curl',tunnelArgs(port,url,chain.bundle),{env,timeout:22000,maxBuffer:1600000}));}catch(e){record.error=String(e.stderr||'Tunnel request failed').slice(0,240);stdout=String(e.stdout||'');}
    const n=stdout.lastIndexOf('\n__RRK_META__');if(n>=0){record.status=Number(stdout.slice(n+13))||0;const body=stdout.slice(0,n);record.characters=body.length;if([401,403,429].includes(record.status))denied=true;if(url.endsWith('/robots.txt')){if(record.status===404)admitted=true;else if(record.status===200){record.reason='Robots policy requires separate review; no automatic continuation';}}else if(record.status===200){record.title=redactPersonalNumbers((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'');record.publicSearchFormLocated=/P199_NATIONALCODECOMPANY/.test(body);attempt.searchPageRetrieved=true;}}
    save();if(denied)break;
   }
   if(denied){report.stoppedOnAccessDenial=true;break;}
   if(attempt.searchPageRetrieved){
    const {default:puppeteer}=await import('puppeteer');browser=await puppeteer.launch({headless:true,env,args:['--no-sandbox','--disable-dev-shm-usage',`--proxy-server=socks5://127.0.0.1:${port}`,'--ssl-version-max=tls1.2','--disable-http2','--disable-quic']});const page=await browser.newPage();await page.setUserAgent('SripPublicSourceAssessment/1.0');await page.setRequestInterception(true);let requests=0;const monitor={report:{stoppedOnAccessDenial:false,httpsVerifiedBy:'native Chromium through public VMess; strict TLS, untrusted intermediate cache'}};
    page.on('response',r=>{if([401,403,429].includes(r.status()))monitor.report.stoppedOnAccessDenial=true;});page.on('request',r=>{let allowed=false;try{const u=new URL(r.url());allowed=!monitor.report.stoppedOnAccessDenial&&++requests<=80&&u.protocol==='https:'&&['rrk.ir','www.rrk.ir'].includes(u.hostname)&&!['image','font','media','stylesheet'].includes(r.resourceType());}catch{}void(allowed?r.continue():r.abort()).catch(()=>{});});
    try{const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:75000});report.browser={status:response?.status()};if(response?.status()===200)await samplePublicNotices(page,{runId,files,report,transport:monitor});}catch(e){report.browser={error:e.message.slice(0,180)};}report.browser.requests=requests;await browser.close();browser=null;break;
   }
   child.kill('SIGTERM');child=null;await sleep(200);
  }
 }catch(e){report.error=String(e.message).replace(/[-a-f0-9]{36}/gi,'[public-config-id-omitted]').slice(0,240);}
 finally{if(browser)await browser.close().catch(()=>{});if(child)child.kill('SIGTERM');fs.rmSync(scratch,{recursive:true,force:true});report.finishedAt=new Date().toISOString();save();}
 return {files,report};
}
