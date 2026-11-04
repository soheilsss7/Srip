import {createHash} from 'node:crypto';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fail=code=>{throw new Error(code);};
export function normalizeTunnelURI(raw){
 return raw.trim().replace(/&amp;/g,'&').replace(/\[([^\]\r\n]+)\]\((?:mailto:|https?:\/\/)[^\)\r\n]+\)/g,'$1');
}
const plain=(s,max=2048)=>{if(typeof s!=='string'||s.length>max||/[\x00-\x1f\x7f]/.test(s))fail('invalid-value');return s;};
const domain=s=>{plain(s,253);if(s&&!/^[a-z0-9_.:-]+$/i.test(s))fail('invalid-host');return s;};
const base64=s=>{if(!/^[a-z0-9+/_=-]+$/i.test(s))fail('invalid-base64');return Buffer.from(s,'base64').toString('utf8');};
function stream(q){
 if(['insecure','allowInsecure','skip-cert-verify'].some(k=>q.has(k)&&!['0','false'].includes(q.get(k))))fail('insecure-tls-refused');
 if(q.has('ech')||q.has('pcs'))fail('unsupported-security-extension');
 const type=q.get('type')||'tcp',security=q.get('security')||'none';
 if(!['tcp','raw','ws','xhttp','grpc'].includes(type)||!['none','tls','reality'].includes(security))fail('unsupported-transport');
 const s={network:['tcp','raw'].includes(type)?'raw':type,security};const header=q.get('headerType')||'none';
 if(!['none','http'].includes(header))fail('unsupported-header');
 if(header==='http'){if(s.network!=='raw')fail('unsupported-header');s.rawSettings={header:{type:'http'}};}
 if(type==='ws')s.wsSettings={path:plain(q.get('path')||'/'),headers:q.get('host')?{Host:domain(q.get('host'))}:{}};
 if(type==='grpc')s.grpcSettings={serviceName:plain(q.get('serviceName')||'',256),multiMode:q.get('mode')==='multi'};
 if(type==='xhttp'){
  const mode=q.get('mode')||'auto';if(!['auto','packet-up','stream-up','stream-one'].includes(mode))fail('unsupported-xhttp-mode');
  let extra={};try{extra=JSON.parse(q.get('extra')||'{}');}catch{fail('invalid-xhttp-extra');}
  if(!extra||Array.isArray(extra)||Object.keys(extra).some(k=>!['mode','xPaddingBytes'].includes(k)))fail('unsupported-xhttp-extra');
  if(extra.mode&&!['auto','packet-up','stream-up','stream-one'].includes(extra.mode))fail('unsupported-xhttp-extra');
  if(extra.xPaddingBytes&&!/^\d{1,5}(?:-\d{1,5})?$/.test(extra.xPaddingBytes))fail('unsupported-xhttp-extra');
  s.xhttpSettings={host:domain(q.get('host')||''),path:plain(q.get('path')||'/'),mode,extra};
 }
 const serverName=domain(q.get('sni')||''),fingerprint=plain(q.get('fp')||'chrome',32);
 if(!/^[a-zA-Z0-9_-]+$/.test(fingerprint))fail('invalid-fingerprint');
 if(security==='tls')s.tlsSettings={serverName,fingerprint,allowInsecure:false,...(q.get('alpn')?{alpn:q.get('alpn').split(',').map(v=>plain(v,32))}:{})};
 if(security==='reality'){
  const publicKey=q.get('pbk')||'',shortId=q.get('sid')||'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(publicKey)||!/^(?:[a-f0-9]{2}){0,8}$/i.test(shortId)||!serverName)fail('invalid-reality');
  s.realitySettings={serverName,fingerprint,password:publicKey,shortId,...(q.get('spx')?{spiderX:plain(q.get('spx'))}:{})};
 }
 return s;
}
export function parseTunnelURI(raw){
 const uri=normalizeTunnelURI(raw);if(uri.length>10000)fail('oversized-uri');let u;try{u=new URL(uri);}catch{fail('malformed-uri');}
 if(!['vless:','vmess:','trojan:','ss:'].includes(u.protocol))fail('unsupported-protocol');
 let address,port,outbound,label;
 if(u.protocol==='vmess:'){
  let v;try{v=JSON.parse(base64(uri.slice(8).split('#')[0]));}catch{fail('invalid-vmess');}
  address=domain(v.add);port=Number(v.port);label=plain(v.ps||'',256);
  if(!uuid.test(v.id||'')||Number(v.aid||0)!==0||v.insecure&&String(v.insecure)!=='0'||v.pcs||v.ech)fail('unsupported-vmess-security');
  if(!['auto','aes-128-gcm','chacha20-poly1305'].includes(v.scy||'auto'))fail('unsupported-vmess-cipher');
  const q=new URLSearchParams({type:v.net||'tcp',security:v.tls||'none',path:v.path||'/',host:v.host||'',sni:v.sni||'',fp:v.fp||'chrome',headerType:v.type||'none'});if(v.alpn)q.set('alpn',v.alpn);
  outbound={protocol:'vmess',settings:{vnext:[{address,port,users:[{id:v.id,alterId:0,security:v.scy||'auto'}]}]},streamSettings:stream(q)};
 }else{
  address=domain(u.hostname);port=Number(u.port);if(u.password)fail('ambiguous-userinfo');label=plain(decodeURIComponent(u.hash.slice(1)),256);const q=u.searchParams;
  if(u.protocol==='ss:'){
   const decoded=base64(decodeURIComponent(u.username)),at=decoded.indexOf(':');if(at<1)fail('invalid-shadowsocks');const method=decoded.slice(0,at),password=plain(decoded.slice(at+1));
   if(!['aes-128-gcm','aes-256-gcm','chacha20-ietf-poly1305'].includes(method)||!password||q.has('plugin'))fail('unsupported-shadowsocks-cipher');
   outbound={protocol:'shadowsocks',settings:{servers:[{address,port,method,password}]}};
  }else{
   const protocol=u.protocol.slice(0,-1),credential=plain(decodeURIComponent(u.username));const st=stream(q);
   if(protocol==='vless'){
    if(!uuid.test(credential))fail('invalid-vless-id');const encryption=q.get('encryption')||'none',flow=q.get('flow')||'';
    if(!/^(?:none|mlkem768x25519plus\.native\.0rtt\.[A-Za-z0-9_-]{43})$/.test(encryption)||!['','xtls-rprx-vision'].includes(flow)||flow&&st.network!=='raw')fail('unsupported-vless-security');
    outbound={protocol,settings:{vnext:[{address,port,users:[{id:credential,encryption,flow}]}]},streamSettings:st};
   }else{if(!credential)fail('missing-trojan-password');outbound={protocol,settings:{servers:[{address,port,password:credential}]},streamSettings:st};}
  }
 }
 if(!address||!Number.isInteger(port)||port<1||port>65535)fail('invalid-endpoint');
 // Labels do not affect identity, but every original input line remains archived.
 const id=createHash('sha256').update(JSON.stringify(outbound)).digest('hex');return {id,label,address,port,outbound};
}
export function parseTunnelList(text){
 if(Buffer.byteLength(text)>1024*1024)fail('oversized-list');const accepted=[],rejected=[],duplicates=[],seen=new Set();let total=0;
 for(const [i,line] of text.split(/\r?\n/).entries()){
  if(!line.trim()||line.trim().startsWith('#'))continue;total++;
  try{const candidate=parseTunnelURI(line);if(seen.has(candidate.id)){duplicates.push({line:i+1,id:candidate.id.slice(0,16)});continue;}seen.add(candidate.id);accepted.push({...candidate,line:i+1});}
  catch(e){rejected.push({line:i+1,reason:e.message});}
 }
 return {total,accepted,rejected,duplicates};
}
export function userXrayConfig(candidate,port,address=candidate.address){
 if(!Number.isInteger(port)||port<1024||port>65535)fail('invalid-listener-port');const outbound=structuredClone(candidate.outbound);
 const server=outbound.settings.vnext?.[0]||outbound.settings.servers[0];server.address=address;
 if(outbound.streamSettings?.tlsSettings&&!outbound.streamSettings.tlsSettings.serverName)outbound.streamSettings.tlsSettings.serverName=candidate.address;
 return {log:{loglevel:'none'},inbounds:[{listen:'127.0.0.1',port,protocol:'socks',settings:{auth:'noauth',udp:false}}],outbounds:[outbound]};
}
