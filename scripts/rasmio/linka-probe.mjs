// Bounded, anonymous company-source assessment. No canonical records are overwritten.
import fs from 'node:fs';
export function extractLinkaFacts(html,url) {
 const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
 const title=decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').trim();
 const metas=[...html.matchAll(/<meta\b[^>]*>/gi)].map(m=>m[0]);
 let description='';
 for(const tag of metas)if(/(?:name|property)\s*=\s*["'](?:description|og:description)["']/i.test(tag))description=decode((tag.match(/content\s*=\s*["']([\s\S]*?)["']/i)||[])[1]||description);
 const text=description.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
 const nationalId=(text.match(/شناسه\s*ملی\s*[:：]?\s*(\d{11})(?!\d)/)||[])[1]||null;
 return {source:'linka.ir',sourceURL:url,title,description,nationalId,identityVerified:!!nationalId,fullProfileVerified:false};
}
export async function runLinkaProbe(){
 const runId=String(process.env.GITHUB_RUN_ID||'local').replace(/[^\w-]/g,'');
 const file=`out/linka-probe-${runId}.json`;fs.mkdirSync('out',{recursive:true});
 const report={runId,mode:'linka-public-company-source-assessment',startedAt:new Date().toISOString(),requests:[],facts:[],limits:{maxRequests:6,maxBytesPerResponse:3000000},canonicalRecordsChanged:false,fullProfileVerified:false,verifiedProfiles:[],attempts:[],verifiedExitCount:0};
 const get=async url=>{
  const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='linka.ir'||u.port||u.username||u.password||/^\/(recaptcha|tag|history|graph|products)(\/|$)/.test(u.pathname))throw new Error('Source URL outside permitted public assessment');
  if(report.requests.length>=6)throw new Error('Request budget exhausted');
  const item={url};report.requests.push(item);
  const r=await fetch(url,{redirect:'manual',headers:{'user-agent':'SripPublicSourceAssessment/1.0','accept-language':'fa'},signal:AbortSignal.timeout(20000)});item.status=r.status;
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const reader=r.body.getReader();const chunks=[];let bytes=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>3000000)throw new Error('Response too large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  item.bytes=bytes;return Buffer.concat(chunks).toString('utf8');
 };
 try{
  const robots=await get('https://linka.ir/robots.txt');report.robots=robots;
  // Stop rather than assuming permissions when the policy differs from the reviewed site policy.
  if(/Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots)||/Disallow:\s*\/company/i.test(robots))throw new Error('Public company crawling disallowed');
  const home=await get('https://linka.ir/');report.home={title:extractLinkaFacts(home,'https://linka.ir/').title,scriptSources:[...home.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>m[1]).slice(0,20)};
  try{const sitemap=await get('https://linka.ir/sitemap/sitemap.xml');report.sitemap={bytes:Buffer.byteLength(sitemap),locations:[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1]).slice(0,10)};}catch(e){report.sitemap={error:e.message};}
  const url='https://linka.ir/company/1f027db/شرکت-نفت-و-گاز-پارس';
  try{const html=await get(url);const fact=extractLinkaFacts(html,url);fact.fetchedAt=new Date().toISOString();report.facts.push(fact);report.profile={rawTables:(html.match(/<table/gi)||[]).length,jsonLdBlocks:(html.match(/application\/ld\+json/gi)||[]).length,bytes:Buffer.byteLength(html)};}catch(e){report.profile={error:e.message};}
 }catch(e){report.error=e.message;}
 report.finishedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));return {files:[file],report};
}
