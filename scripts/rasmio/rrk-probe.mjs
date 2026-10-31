import fs from 'node:fs';
export function inspectRrkHTML(html){
 const title=(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]?.replace(/\s+/g,' ').trim()||null;
 return {title,oracleApexIndicated:/(?:apex\.jQuery|wwv_flow|p_flow_id|P28_SABTNATIONALID_DISPLAY)/i.test(html),apexDetailFieldsPresent:['P28_COMPANYNAME_DISPLAY','P28_SABTNATIONALID_DISPLAY','P28_TEXT_DISPLAY'].filter(id=>html.includes(id)),forms:(html.match(/<form\b/gi)||[]).length,inputs:[...html.matchAll(/<input\b[^>]*>/gi)].slice(0,40).map(m=>({name:(m[0].match(/\bname=["']([^"']+)/i)||[])[1]||null,type:(m[0].match(/\btype=["']([^"']+)/i)||[])[1]||null})),captchaIndicated:/captcha|کد\s*امنیتی|کد\s*تصویر/i.test(html),loginIndicated:/UserLogin\.aspx|ورود\s*به\s*(?:سامانه|سیستم|حساب)/i.test(html),nationalIdSearchIndicated:/شناسه\s*ملی/.test(html),advertLinks:[...html.matchAll(/href=["']([^"']*(?:ShowNews|NewsDetail|f-detail-ad|f\?p=200:28)[^"']*)["']/gi)].map(m=>m[1]).slice(0,8)};
}
export async function runRrkProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');fs.mkdirSync('out',{recursive:true});const file=`out/rrk-probe-${runId}.json`;
 const report={runId,mode:'rrk-public-source-assessment',startedAt:new Date().toISOString(),limits:{maxRequests:6,secondsPerRequest:15,maxBodyBytes:1500000},requests:[],verifiedProfiles:[],attempts:[],verifiedExitCount:0,canonicalRecordsChanged:false,advertsExtracted:0,relationshipsExtracted:0,fullCoverageVerified:false};
 let accessDenied=false;
 const get=async url=>{
  const u=new URL(url);if(u.protocol!=='https:'||!['rrk.ir','www.rrk.ir'].includes(u.hostname)||u.port||u.username||u.password||report.requests.length>=6)throw new Error('Probe scope exceeded');
  const item={url,at:new Date().toISOString()};report.requests.push(item);
  try{
   const r=await fetch(url,{redirect:'manual',headers:{'user-agent':'SripPublicSourceAssessment/1.0','accept-language':'fa'},signal:AbortSignal.timeout(15000)});item.status=r.status;if([401,403,429].includes(r.status)){accessDenied=true;report.stopReason='explicit-access-denial';}item.location=r.headers.get('location');
   const reader=r.body.getReader();let bytes=0;const chunks=[];
   try{for(;;){const a=await reader.read();if(a.done)break;bytes+=a.value.length;if(bytes>1500000)throw new Error('Response too large');chunks.push(a.value);}}finally{await reader.cancel().catch(()=>{});}
   const text=Buffer.concat(chunks).toString('utf8');item.bytes=bytes;
   if(!u.pathname.endsWith('robots.txt'))item.html=inspectRrkHTML(text);
   return {status:r.status,text};
  }catch(e){item.error=String(e.cause?.message||e.message).slice(0,240);return null;}
 };
 try{
  // Modern RRK is Oracle APEX; old News/newsList.aspx alone is not a sufficient assessment.
  report.routeEvidence={url:'https://github.com/majid-abedi/rrk-crawler',file:'config.py',publicRoute:'https://rrk.ir/ords/f?p=200:199',thirdPartySessionOrCookiesUsed:false};
  for(const host of ['rrk.ir','www.rrk.ir']){
   const robots=await get(`https://${host}/robots.txt`);
   if(accessDenied)break;
   if(robots?.status===200) {
    report.robots ||= {};report.robots[host]=robots.text.slice(0,10000);
    if(/Disallow:\s*\/(?:\s|$)|Disallow:\s*\/ords/i.test(robots.text))continue;
   }
   // Unknown robots (e.g. connection timeout) must not trigger automated form interaction.
   // These are bounded GET-only entrypoint checks, never session replay or CAPTCHA bypass.
   await get(`https://${host}/ords/f?p=200:199`);
   if(accessDenied)break;
   await get(`https://${host}/`);
  }
 }catch(e){report.error=e.message;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));return {files:[file],report};
}
