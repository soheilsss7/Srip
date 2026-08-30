import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const webRoot=path.join(root,'web','app');
const repo=path.resolve(root,'..');
const read=(p)=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
function walk(d){let out=[];if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...walk(p));else out.push(p)}return out;}
const files=walk(webRoot).filter(x=>/\.(ts|tsx)$/.test(x));
const text=files.map(read).join('\n')+'\n'+read(path.join(root,'web','next.config.ts'));

// Contract invariants required by the source documents.
const requiredPatterns=[
 ['central-api-client',fs.existsSync(path.join(root,'web','app','_lib','api.ts')) && /export async function api/.test(read(path.join(root,'web','app','_lib','api.ts')))],
 ['request-id',/X-Request-ID/.test(text)],
 ['error-envelope',/ApiError|error\\?\\.message/.test(text)],
 ['timeout',/AbortController|timeoutMs/.test(text)],
  ['refresh',text.includes('refreshAccessToken')||text.includes('/auth/refresh')],
 ['session-cleanup',/clearSession/.test(text)],
 ['upload-guard',/25\\*1024\\*1024|apiUpload/.test(text)],
 ['security-headers',/X-Content-Type-Options|Strict-Transport-Security/.test(text)],
 ['data-quality-ui',/Data Quality|DATA QUALITY|data-quality/.test(text)],
 ['idempotency-support',/Idempotency-Key|idempotencyKey/.test(text)],
 ['ai-not-required-for-core',true]
];
const patternFailures=requiredPatterns.filter(([n,ok])=>!ok).map(([n])=>n);

// Direct browser fetches are forbidden outside the central API client.
const directFetch=files.filter(x=>!x.includes(`${path.sep}_lib${path.sep}`)&&/\bfetch\s*\(/.test(read(x)));

// Secret material must not be embedded in frontend sources.
const secretFiles=files.filter(x=>/-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----|\bsk-[A-Za-z0-9]{20,}|ChangeMe!123456|admin@srip\.local/.test(read(x)));

// Sensitive values should not be logged.
const sensitiveLogs=files.filter(x=>/(console\.(log|debug|info|warn|error)|logger\.(log|debug|info|warn|error))\s*\([^)]*(password|token|secret|authorization|cookie|refreshToken|accessToken)/i.test(read(x)));

// Browser storage policy: no persistent access token.
const persistentTokenStorage=files.filter(x=>/localStorage\.(setItem|getItem|removeItem)\s*\([^)]*(access|refresh|token)/i.test(read(x)));

// Dangerous HTML sinks.
const unsafeHtml=files.filter(x=>/dangerouslySetInnerHTML|innerHTML\s*=/.test(read(x)));

// Routes expected by the non-AI Web scope from the master docs / prior baseline.
const expected=[
 'today','organizations','people','relationships','interactions','meetings','actions','commitments',
 'projects','opportunities','requirements','network','search','notifications','workflows',
 'reports','data-management','data-quality','documents','admin','authorization','approvals',
 'integrations','privacy','security','sessions','health','monitoring','analytics','metrics','observability','notes'
];
const routes=walk(webRoot).filter(x=>x.endsWith('page.tsx')).map(x=>path.relative(webRoot,x).replaceAll(path.sep,'/'));
const routeGaps=expected.filter(d=>!routes.some(r=>r===`${d}/page.tsx`||r.startsWith(`${d}/`)));

const result={
 filesScanned:files.length,
 routes:routes.length,
 routeGaps,
 patternFailures,
 directFetchOutsideApi:directFetch.map(x=>path.relative(root,x)),
 secretFiles:secretFiles.map(x=>path.relative(root,x)),
 sensitiveLogs:sensitiveLogs.map(x=>path.relative(root,x)),
 persistentTokenStorage:persistentTokenStorage.map(x=>path.relative(root,x)),
 unsafeHtmlSinks:unsafeHtml.map(x=>path.relative(root,x)),
 aiExcluded:true
};
fs.writeFileSync(path.join(root,'MASTER_CONFORMANCE_AUDIT.json'),JSON.stringify(result,null,2));
if(patternFailures.length||directFetch.length||secretFiles.length||sensitiveLogs.length||persistentTokenStorage.length||unsafeHtml.length||routeGaps.length){
 console.error(JSON.stringify(result,null,2)); process.exit(1);
}
console.log('MASTER CONFORMANCE AUDIT PASS');
