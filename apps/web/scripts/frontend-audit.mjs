import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('.',import.meta.url).pathname,'..','app');
const files=[];
function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(/\.(ts|tsx)$/.test(e.name))files.push(p);}}
walk(root);
const text=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const failures=[];
const demoCredFiles = files.filter(f => /ChangeMe!123456/.test(fs.readFileSync(f, 'utf8')) && !/demo@srip\.local/.test(fs.readFileSync(f, 'utf8')));
if (/admin@srip\.local/.test(text) || demoCredFiles.length) failures.push('hard-coded development credentials remain');
if(/localStorage\.getItem\(['"]srip_token/.test(text)) failures.push('legacy persistent access-token storage remains');
for(const f of files){const s=fs.readFileSync(f,'utf8');if(/-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----/.test(s)||/\bsk-[A-Za-z0-9]{20,}/.test(s))failures.push(`secret-like material in ${f}`);}
const directFetch=files.filter(f=>!f.includes(`${path.sep}_lib${path.sep}`)&&/fetch\(/.test(fs.readFileSync(f,'utf8')));
if(directFetch.length) failures.push(`direct fetch outside API layer: ${directFetch.map(x=>path.relative(root,x)).join(', ')}`);
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Frontend audit PASS: ${files.length} TS/TSX files scanned.`);
