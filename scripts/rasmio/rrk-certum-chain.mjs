// Complete a missing server-supplied intermediate, without trusting a new root or disabling TLS checks.
import fs from 'node:fs';
import path from 'node:path';
import {X509Certificate} from 'node:crypto';
export const issuerURL='https://certumdvtlsg2r39ca.repository.certum.pl/certumdvtlsg2r39ca.cer';
export function chainCompletionCandidates(source,prior,denied=new Set(),now=Date.now()) {
 return [...new Set((prior.attempts||[]).filter(a=>a.status===0&&/unable to get local issuer certificate/i.test(a.error||'')&&now-Date.parse(a.at)>=0&&now-Date.parse(a.at)<86400000&&source.proxies.includes(a.proxy)&&!denied.has(a.proxy)).map(a=>a.proxy))].slice(0,3);
}
export function checkIssuerCertificate(cert,now=Date.now()) {
 const x=new X509Certificate(cert);
 if(!x.ca||!/^CN=Certum DV TLS G2 R39 CA$/m.test(x.subject)||now<Date.parse(x.validFrom)||now>Date.parse(x.validTo))throw new Error('Unexpected or expired issuer certificate');
 return x;
}
export async function prepareCertumChain(scratch,execute,env) {
 const der=path.join(scratch,'certum-issuer.der'),pem=path.join(scratch,'certum-issuer.pem'),bundle=path.join(scratch,'certum-complete-chain.pem');
 let downloaded=false,downloadURL=issuerURL;
 for(const url of [issuerURL,issuerURL.replace('https:','http:')]) {
  // The HTTP AIA fallback transports only a public certificate. It cannot add trust:
  // OpenSSL must validate its signature/chain against the pre-existing OS root store below.
  try{await execute('curl',['-q','--silent','--show-error','--fail','--noproxy','*','--proto',url.startsWith('https:')?'=https':'=http','--max-redirs','0','--connect-timeout','5','--max-time','12','--max-filesize','50000','--output',der,url],{env,timeout:14000,maxBuffer:100000});downloaded=true;downloadURL=url;break;}catch{}
 }
 if(!downloaded)throw new Error('Could not obtain the public issuer certificate');
 const x=checkIssuerCertificate(fs.readFileSync(der));fs.writeFileSync(pem,x.toString());
 const roots='/etc/ssl/certs/ca-certificates.crt';
 const verified=await execute('openssl',['verify','-CAfile',roots,pem],{env,timeout:5000,maxBuffer:100000});
 if(!verified.stdout.includes(': OK'))throw new Error('Issuer did not validate to an existing system root');
 fs.writeFileSync(bundle,fs.readFileSync(roots,'utf8')+'\n'+x.toString());
 return {bundle,evidence:{downloadURL,subject:x.subject,issuer:x.issuer,fingerprint256:x.fingerprint256,validFrom:x.validFrom,validTo:x.validTo,verifiedAgainstExistingSystemRoots:true,tlsValidationDisabled:false}};
}
