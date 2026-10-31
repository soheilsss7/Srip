// Cache an already OS-root-verified intermediate as UNTRUSTED in Chromium's NSS DB.
// Do not add a trusted CA, disable certificate errors, or modify the OS trust store.
import fs from 'node:fs';import path from 'node:path';
export function issuerImportArgs(database,certificate){return ['-A','-d',`sql:${database}`,'-n','RRK Certum verified intermediate','-t',',,','-i',certificate];}
export async function prepareNativeIssuerCache({scratch,env,execute}){
 const certificate=path.join(scratch,'certum-issuer.pem');if(!fs.existsSync(certificate))throw new Error('Verified issuer missing');
 // Re-verify immediately before import, against existing system roots, not against our bundle.
 await execute('openssl',['verify','-CAfile','/etc/ssl/certs/ca-certificates.crt',certificate],{env,timeout:5000,maxBuffer:100000});
 let installed=false;try{await execute('which',['certutil'],{env,timeout:5000,maxBuffer:1000000});}catch(e){if(e.code!=='ENOENT'&&e.code!==1)throw e;await execute('sudo',['-n','apt-get','install','-y','--no-install-recommends','libnss3-tools'],{env,timeout:90000,maxBuffer:1000000});installed=true;}
 const database=path.join(scratch,'.pki','nssdb');fs.mkdirSync(database,{recursive:true});
 await execute('certutil',['-N','--empty-password','-d',`sql:${database}`],{env,timeout:5000,maxBuffer:100000});
 await execute('certutil',issuerImportArgs(database,certificate),{env,timeout:5000,maxBuffer:100000});
 const listed=await execute('certutil',['-L','-d',`sql:${database}`],{env,timeout:5000,maxBuffer:100000});
 if(!/RRK Certum verified intermediate\s+,,\s*$/m.test(listed.stdout))throw new Error('Issuer cache trust flags did not remain empty');
 return {installedTools:installed,intermediateCached:true,nssTrustFlags:',,',newTrustAnchorAdded:false,tlsValidationDisabled:false};
}
