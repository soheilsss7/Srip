import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const apiRoot=path.join(root,'api','src');
const webRoot=path.join(root,'web','app');
function walk(d){let out=[];if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...walk(p));else out.push(p)}return out;}
const controllers=walk(apiRoot).filter(x=>x.endsWith('controller.ts')&&!x.endsWith('ai.controller.ts'));
const routes=walk(webRoot).filter(x=>x.endsWith('page.tsx')).map(x=>path.relative(webRoot,x)).filter(x=>!x.startsWith('_'));
const expected=['today','organizations','people','relationships','interactions','meetings','actions','commitments','projects','opportunities','requirements','network','search','notifications','workflows','reports','data-management','data-quality','documents','admin','authorization','approvals','integrations','privacy','security','sessions','health','monitoring','analytics','metrics','observability','notes'];
const missing=expected.filter(x=>!routes.some(r=>r===`${x}/page.tsx`||r.startsWith(`${x}/`)));
const directFetch=walk(webRoot).filter(x=>/\.(ts|tsx)$/.test(x)&&!x.includes(`${path.sep}_lib${path.sep}`)&&/fetch\(/.test(fs.readFileSync(x,'utf8')));
const secrets=walk(webRoot).filter(x=>/\.(ts|tsx|js|jsx)$/.test(x)&&/-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----|\bsk-[A-Za-z0-9]{20,}/.test(fs.readFileSync(x,'utf8')));
const result={controllers:controllers.map(x=>path.relative(apiRoot,x)),controllerCount:controllers.length,webRouteCount:routes.length,expectedDomainRouteGaps:missing,directFetchOutsideApiLayer:directFetch.map(x=>path.relative(webRoot,x)),secretLikeFiles:secrets.map(x=>path.relative(webRoot,x)),aiControllerExcluded:true};
fs.writeFileSync(path.join(root,'REPOSITORY_WEB_CONTRACT_AUDIT.json'),JSON.stringify(result,null,2));
if(missing.length||directFetch.length||secrets.length){console.error(JSON.stringify(result,null,2));process.exit(1);}
console.log(`Contract audit PASS: ${controllers.length} non-AI controllers; ${routes.length} Web routes.`);
