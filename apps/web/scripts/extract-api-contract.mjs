import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(scriptDir,'..','..','..');
const srcRoot=path.join(repoRoot,'apps','api','src');
function walk(d){let out=[];if(!fs.existsSync(d))return out;for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())out.push(...walk(p));else if(p.endsWith('.controller.ts'))out.push(p)}return out;}
const controllers=walk(srcRoot);
const routes=[];
for(const f of controllers){
  const text=fs.readFileSync(f,'utf8');
  const lines=text.split('\n');
  let base='';
  const cs=lines.filter(l=>/^\s*@Controller\(/.test(l));
  if(cs.length){const m=cs[0].match(/@Controller\(([^)]*)\)/);if(m)base=m[1].replace(/["'\s`]/g,'');}
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^\s*@(Get|Post|Put|Patch|Delete|All)\(([^)]*)\)/)||lines[i].match(/^\s*@(Get|Post|Put|Patch|Delete|All)\b(?!\()/);
    if(!m)continue;
    const method=m[1].toUpperCase();
    let seg=(m[2]??'').replace(/["'\s`]/g,'');
    if(m[2]===undefined)seg='';
    // look back for @UseGuards before this method (within this method body start)
    let guard='';let isPublic=false;
    for(let j=i-1;j>=Math.max(0,i-8);j--){
      const gm=lines[j].match(/@UseGuards\(([^)]*)\)/);if(gm){guard=gm[1].replace(/\s/g,'');}
      if(/@Public/.test(lines[j]))isPublic=true;
      if(/^\s*(@|\S+\(|public |async |private )/.test(lines[j])&&/@/.test(lines[j])===false)break;
    }
    let p=((base+'/'+seg).replace(/\/{2,}/g,'/').replace(/\/$/,''))||'/';
    routes.push({method,route:p,file:path.basename(f),line:i+1,guard,public:isPublic});
  }
}
fs.writeFileSync(path.join(repoRoot,'API_CONTRACT.json'),JSON.stringify(routes,null,2));
console.log(routes.length+' routes -> '+path.join(repoRoot,'API_CONTRACT.json'));
