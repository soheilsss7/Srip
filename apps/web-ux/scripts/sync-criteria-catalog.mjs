/* ============================================================================
   sync-criteria-catalog.mjs — کاتالوگ معیارها را از منبع حقیقت (apps/api)
   به JSON ساده تبدیل می‌کند تا Mock API و Service Worker نسخهٔ دمو همان
   داده‌ها را ببینند، نه یک کپی دستی.

   منبع حقیقت: apps/api/src/criteria/criteria.catalog.ts
   خروجی:      apps/web-ux/scripts/criteria-data.json

   اجرای بازبینی: pnpm --filter @srip/web-ux sync:criteria   (سپس release-ux)
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const source = path.join(repoRoot, 'apps', 'api', 'src', 'criteria', 'criteria.catalog.ts');
const outFile = path.join(__dirname, 'criteria-data.json');

const text = fs.readFileSync(source, 'utf8');

/** برچینش متوازن براکت‌ها برای بیرون‌کشیدن یک مقدار جاوااسکریپتی از فایل TS. */
function literalOf(declaration) {
  const start = text.indexOf(declaration);
  if (start < 0) throw new Error(`declaration not found: ${declaration}`);
  const eq = text.indexOf('=', start + declaration.length);
  if (eq < 0) throw new Error(`no initializer for ${declaration}`);
  let i = eq + 1;
  while (i < text.length && /\s/.test(text[i])) i++;
  const openCh = text[i];
  const closeCh = openCh === '[' ? ']' : openCh === '{' ? '}' : null;
  if (!closeCh) throw new Error(`unexpected initializer for ${declaration}: ${openCh}`);
  let depth = 0;
  let inString = null;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inString) {
      if (ch === '\\') j++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && ch === closeCh) return text.slice(i, j + 1);
    }
  }
  throw new Error(`unbalanced literal for ${declaration}`);
}

const evalLiteral = (src) => new Function(`return (${src.replace(/\s+as\s+const\b/g, '')});`)();

const data = {
  generatedFrom: 'apps/api/src/criteria/criteria.catalog.ts',
  generatedAt: new Date().toISOString(),
  scales: evalLiteral(literalOf('export const SCALES')),
  familyMeta: evalLiteral(literalOf('export const FAMILY_META')),
  familyWeights: evalLiteral(literalOf('export const FAMILY_WEIGHTS')),
  criteria: evalLiteral(literalOf('export const CRITERIA: Criterion[]')),
};

// همان اعتبارسنجی‌هایی که موتور API می‌دهد — تا خروجی ناقص منتشر نشود.
const codes = new Set();
for (const c of data.criteria) {
  if (!c.code || codes.has(c.code)) throw new Error(`duplicate/missing criterion code: ${c.code}`);
  codes.add(c.code);
  if (!data.familyMeta[c.family]) throw new Error(`unknown family ${c.family} on ${c.code}`);
  if (!c.anchors && !data.scales[c.scaleId]) throw new Error(`unknown scale ${c.scaleId} on ${c.code}`);
  for (const subject of c.appliesTo) if (!data.familyWeights[subject]) throw new Error(`unknown subject ${subject} on ${c.code}`);
  if (typeof c.halfLifeDays !== 'number') throw new Error(`missing halfLifeDays on ${c.code}`);
}
for (const [subject, weights] of Object.entries(data.familyWeights)) {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(total - 1) > 0.001) throw new Error(`family weights for ${subject} must sum to 1 (got ${total})`);
}

const payload = JSON.stringify(data, null, 1);
// --check : فقط اختلاف را گزارش می‌کند (برای CI و انتشار) — بدون نوشتن فایل
if (process.argv.includes('--check')) {
  const strip = (o) => { const { generatedAt, ...rest } = o || {}; return rest; };
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { prev = null; }
  if (!prev) { console.error('[sync-criteria] criteria-data.json وجود ندارد — اول اجرا کنید: pnpm sync:criteria'); process.exit(1); }
  const a = JSON.stringify(strip(prev));
  const b = JSON.stringify(strip(data));
  if (a !== b) { console.error('[sync-criteria] کاتالوگ API با JSON دمو اختلاف دارد؛ باید هم‌رسانی شود (pnpm sync:criteria).'); process.exit(1); }
  console.log(`[sync-criteria] بدون اختلاف — ${data.criteria.length} معیار با کاتالوگ API یکی است`);
  process.exit(0);
}
fs.writeFileSync(outFile, payload);
console.log(
  `[sync-criteria] ${data.criteria.length} معیار، ${Object.keys(data.familyMeta).length} خانواده، ${Object.keys(data.scales).length} مقیاس → ${path.relative(repoRoot, outFile)} (${(payload.length / 1024).toFixed(1)} KB)`,
);
