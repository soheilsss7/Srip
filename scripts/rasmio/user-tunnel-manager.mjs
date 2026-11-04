import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {lookup} from 'node:dns/promises';import {createHash} from 'node:crypto';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {parsePublicProxy} from './public-proxy-candidates.mjs';import {userXrayConfig} from './user-tunnel-configs.mjs';
const execute=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const clientArchive={url:'https://github.com/XTLS/Xray-core/releases/download/v26.10.31/Xray-linux-64.zip',sha256:'e4bd9119f50ae7c41658b1abd0679ae06f98bd864a2907ff33f2f2cf7081b214'};
export async function resolveTunnelEndpoint(candidate,resolve=lookup){
 let addresses;try{addresses=await resolve(candidate.address,{family:4,all:true});}catch{throw new Error('tunnel-dns-failed');}
 if(!addresses?.length||addresses.some(a=>!parsePublicProxy(`http://${a.address}:${candidate.port}`)))throw new Error('tunnel-public-ipv4-required');return addresses[0].address;
}
export async function freeTunnelPort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
export class UserTunnelManager{
 constructor({scratch,executeImpl=execute,spawnImpl=spawn,maxClients=8,env={PATH:process.env.PATH,HOME:scratch,LANG:'C.UTF-8'}}){this.scratch=scratch;this.execute=executeImpl;this.spawn=spawnImpl;this.env=env;this.maxClients=maxClients;this.clients=new Map();this.pending=new Map();this.binary=path.join(scratch,'xray-user');}
 async prepare(){
  const zip=path.join(this.scratch,'user-xray.zip');
  try{
   await this.execute('curl',['-q','--silent','--show-error','--fail','--location','--proto','=https','--proto-redir','=https','--max-redirs','3','--max-time','60','--max-filesize','25000000','--output',zip,clientArchive.url],{env:this.env,timeout:65000,maxBuffer:100000});
   if(createHash('sha256').update(fs.readFileSync(zip)).digest('hex')!==clientArchive.sha256)throw Error();
   const result=await this.execute('unzip',['-p',zip,'xray'],{env:this.env,encoding:'buffer',timeout:10000,maxBuffer:64000000});fs.writeFileSync(this.binary,result.stdout,{mode:0o700});
  }catch{throw new Error('tunnel-client-install-failed');}
  return this;
 }
 async start(candidate){
  if(this.clients.has(candidate.id))return this.clients.get(candidate.id).endpoint;
  if(this.pending.has(candidate.id))return this.pending.get(candidate.id);
  if(this.clients.size+this.pending.size>=this.maxClients)throw new Error('tunnel-client-capacity');
  const task=this.launch(candidate);this.pending.set(candidate.id,task);try{return await task;}finally{this.pending.delete(candidate.id);}
 }
 async launch(candidate){
  const address=await resolveTunnelEndpoint(candidate),port=await freeTunnelPort(),file=path.join(this.scratch,`user-${candidate.id}.private.json`);fs.writeFileSync(file,JSON.stringify(userXrayConfig(candidate,port,address)),{mode:0o600});
  try{await this.execute(this.binary,['run','-test','-config',file],{env:this.env,timeout:5000,maxBuffer:30000});}catch{fs.rmSync(file,{force:true});throw new Error('tunnel-client-config-rejected');}
  const child=this.spawn(this.binary,['run','-config',file],{env:this.env,stdio:'ignore'});let spawnFailed=false;child.on('error',()=>{spawnFailed=true;});
  const endpoint={url:`socks5://127.0.0.1:${port}`,trustedLocal:true,tunnelId:candidate.id.slice(0,16),release:()=>this.stop(candidate.id)};this.clients.set(candidate.id,{child,file,endpoint});
  try{
   for(let i=0;i<25;i++){
    if(spawnFailed||child.exitCode!==null)throw new Error('tunnel-client-exited');
    if(await new Promise(resolve=>{const s=net.connect({host:'127.0.0.1',port});s.setTimeout(150);s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>{s.destroy();resolve(false);});s.once('timeout',()=>{s.destroy();resolve(false);});}))return endpoint;
    await sleep(100);
   }
   throw new Error('tunnel-listener-timeout');
  }catch(e){this.stop(candidate.id);throw e;}
 }
 stop(id){const client=this.clients.get(id);if(!client)return;this.clients.delete(id);client.child.kill('SIGTERM');const timer=setTimeout(()=>{if(client.child.exitCode===null)client.child.kill('SIGKILL');},1000);timer.unref();fs.rmSync(client.file,{force:true});}
 close(){for(const id of [...this.clients.keys()])this.stop(id);}
}
