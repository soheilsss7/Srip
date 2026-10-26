import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('../../src', import.meta.url).pathname);
const failures = [];
const skip = ['/ai/', '/auth/', '/common/mfa/', '/common/authorization/', '/prisma/', '/observability/', '/health/'];

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const serviceFiles = files(root).filter(f => f.endsWith('.service.ts'));
for (const file of serviceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (skip.some(x => file.includes(x))) continue;
  if (text.includes('this.prisma.') && !text.includes('entity-response.dto')) {
    failures.push(`Missing DTO boundary import: ${path.relative(root, file)}`);
  }
  if (/return\s+this\.prisma\.(?![A-Za-z0-9_]+\.(?:count|exists)\s*\()/s.test(text)) {
    failures.push(`Direct Prisma object return remains: ${path.relative(root, file)}`);
  }
}

const presenter = fs.readFileSync(path.join(root, 'common/authorization/relationship-presenter.ts'), 'utf8');
if (!presenter.includes("relationship-response.dto")) failures.push('RelationshipPresenter does not use RelationshipResponseDto');
if (!presenter.includes('fields.sanitize')) failures.push('RelationshipPresenter bypasses FieldSecurityService');

const dto = fs.readFileSync(path.join(root, 'common/dto/entity-response.dto.ts'), 'utf8');
for (const key of ['passwordHash','refreshTokenHash','accessTokenEncrypted','refreshTokenEncrypted','secretEncrypted','storageKey','deletedById']) {
  if (!dto.includes(`'${key}'`)) failures.push(`DTO security block missing: ${key}`);
}

const repoRoot = path.resolve(root, '../../..');
const parse = spawnSync('node', ['-e', `
const {createRequire}=require('module');
const ts=createRequire(process.argv[1])( 'typescript' );
const fs=require('fs'),path=require('path');let e=[];
function w(d){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())w(p);else if(p.endsWith('.ts')){const o=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS},reportDiagnostics:true,fileName:p});for(const x of o.diagnostics||[])e.push([p,ts.flattenDiagnosticMessageText(x.messageText,' ')]);}}}
w(process.argv[2]);console.log(e.length);if(e.length)process.exit(1);
`, path.join(repoRoot, 'package.json'), root], { encoding: 'utf8' });
if (parse.status !== 0 || parse.stdout.trim() !== '0') failures.push(`TypeScript syntax/parse verification failed: ${parse.stderr || parse.stdout}`);

console.log(`SERVICE_FILES_CHECKED=${serviceFiles.length}`);
console.log(`DIRECT_PRISMA_RETURNS=${failures.filter(x=>x.includes('Direct Prisma')).length}`);
console.log(`PHASE_G_FAILURES=${failures.length}`);
if (failures.length) { for (const f of failures) console.error(`FAIL ${f}`); process.exit(1); }
console.log('PHASE_G_DTO_VERIFICATION=PASS');
