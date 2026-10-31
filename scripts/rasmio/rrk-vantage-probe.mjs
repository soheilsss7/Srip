// Ordinary public connectivity diagnostics only. Never use public probes as a bulk crawler or relay.
import fs from 'node:fs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export function measurementRequest(country) {
 if(!['IR','DE'].includes(country))throw new Error('Unapproved comparison location');
 return {type:'http',target:'rrk.ir',locations:[{country}],limit:2,timeout:20,measurementOptions:{protocol:'HTTPS',request:{method:'GET',path:'/ords/f',query:'p=200:199'}}};
}
export function summarizeMeasurement(value) {
 return (value.results||[]).map(item=>{
  const r=item.result||{},p=item.probe||{};
  return {country:p.location?.country||p.country||null,city:p.location?.city||null,asn:p.asn||null,network:p.network||null,status:r.status||null,statusCode:r.statusCode??null,authorizedTLS:r.tls?.authorized===true,tlsError:r.tls?.error||null,tlsSubject:r.tls?.subject?.CN||null,tlsIssuer:r.tls?.issuer?.CN||null,resolvedAddress:r.resolvedAddress||null,truncated:r.truncated??null,bodyCharacters:r.rawBody?.length||0,transportOutput:r.statusCode==null?String(r.rawOutput||'').replace(/(?<!\d)\d{10,11}(?!\d)/g,'[redacted]').slice(0,1200):null};
 });
}
export async function runRrkVantageProbe({fetchImpl=globalThis.fetch,wait=pause,out='out',runId=process.env.GITHUB_RUN_ID||'local'}={}) {
 runId=String(runId).replace(/[^\w-]/g,'');fs.mkdirSync(out,{recursive:true});const file=`${out}/rrk-vantage-probe-${runId}.json`;
 const report={runId,mode:'rrk-independent-public-vantages',startedAt:new Date().toISOString(),limits:{measurementSubmissions:2,globalpingProbesPerSubmission:2,resultPolls:6,pollIntervalSeconds:5},measurements:[],requests:[],verifiedProfiles:[],attempts:[],verifiedExitCount:0,advertsExtracted:0,canonicalRecordsChanged:false,fullCoverageVerified:false,usableCrawlerRoute:false,publicProbeNotABulkProxy:true};
 let providerDenied=false;
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));
 const request=async(url,options={})=>{
  const u=new URL(url);if(!['api.globalping.io','check-host.net'].includes(u.hostname)||u.protocol!=='https:'||u.username||u.password||u.port)throw new Error('Diagnostic API scope exceeded');
  const entry={url,method:options.method||'GET',at:new Date().toISOString()};report.requests.push(entry);save();
  const r=await fetchImpl(url,{...options,redirect:'error',headers:{accept:'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});
  entry.status=r.status;entry.retryAfter=r.headers.get('retry-after');save();
  if([401,403,429].includes(r.status)){providerDenied=true;throw new Error(`Diagnostic provider denied/rate-limited: ${r.status}`);}
  if(!r.ok)throw new Error(`Diagnostic provider HTTP ${r.status}`);
  const text=await r.text();if(text.length>4000000)throw new Error('Diagnostic result exceeds bound');return JSON.parse(text);
 };
 try {
  // Do not retry check-host after its HTTP 429, including from a new runner IP.
  report.checkHost={status:'not-requested',reason:'Prior run 41221371070 was rate-limited; no retries or IP rotation'};
  for(const country of ['IR','DE']) {
   const item={requestedCountry:country};report.measurements.push(item);
   try {
    const created=await request('https://api.globalping.io/v1/measurements',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(measurementRequest(country))});
    if(!/^[A-Za-z0-9_-]+$/.test(created.id||''))throw new Error('Invalid measurement ID');
    item.id=created.id;
    for(let i=0;i<6;i++){
     await wait(5000);const result=await request(`https://api.globalping.io/v1/measurements/${created.id}`);item.measurementStatus=result.status;item.results=summarizeMeasurement(result);save();if(result.status==='finished')break;
    }
    if(item.results?.some(r=>[401,403,429].includes(r.statusCode))){report.stoppedOnOriginDenial=true;break;}
   }catch(e){item.error=e.message;if(providerDenied)break;}
  }
 }catch(e){report.error=e.message;}
 finally {report.finishedAt=new Date().toISOString();report.httpsRespondingVantages=report.measurements.flatMap(m=>m.results||[]).filter(r=>r.authorizedTLS&&r.statusCode!==null);save();}
 return {files:[file],report};
}
