/* ============================================================================
   gen-icons.mjs — ساخت آیکون‌های PWA (svg + png برای apple/maskable)
   نشان «شبکۀ روابط» روی زمینهٔ سرمه‌ای→فیروزه‌ای.

   چرا اسکریپت؟ خروجی استاتیکِ docs/srip2 باید آیکون واقعی داشته باشد، ولی ما
   باینری دست‌ساز را در مخزن نمی‌گذاریم. SVG مستقیم نوشته می‌شود و PNG با
   ImageMagick ترسیم می‌شود (بدون delegate: چون rsvg روی many CI‌ها نیست،
   از رسم مستقیم استفاده می‌کنیم تا همیشه کار کند). اگر convert نبود، فقط
   SVG ساخته می‌شود و build نمی‌شکند.
   ============================================================================ */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, '..', 'public');
const S = 512; // بوم مرجع

const NAVY = '#0B2F4A';
const TEAL = '#0F9B8E';
const LINE = '#DFF6F2';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="SRIP">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${TEAL}"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="108" fill="url(#g)"/>
  <g stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="22" stroke-linecap="round">
    <line x1="150" y1="330" x2="256" y2="176"/>
    <line x1="256" y1="176" x2="366" y2="318"/>
    <line x1="150" y1="330" x2="366" y2="318"/>
  </g>
  <g fill="#FFFFFF">
    <circle cx="256" cy="176" r="52"/>
    <circle cx="150" cy="330" r="40"/>
    <circle cx="366" cy="318" r="40"/>
  </g>
  <circle cx="256" cy="176" r="24" fill="${NAVY}"/>
</svg>`;

/** فرمان‌های ترسیم PNG مرجع ( گرادیان + یال‌ها + گره‌ها ) */
function masterCmds() {
  const drawEdges = `stroke '${LINE}' stroke-linecap round stroke-width 22 fill none `
    + `line 150,330 256,176 line 256,176 366,318 line 150,330 366,318`;
  const drawNodes = `fill '#FFFFFF' stroke none `
    + `circle 256,176 256,124 circle 150,330 150,290 circle 366,318 366,278`;
  const drawCore = `fill '${NAVY}' stroke none circle 256,176 256,200`;
  return [drawEdges, drawNodes, drawCore];
}

function run(args) {
  execFileSync('convert', args, { stdio: 'pipe' });
}

function hasImageMagick() {
  try { execFileSync('convert', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, 'icon.svg'), SVG);
let made = ['icon.svg'];

if (hasImageMagick()) {
  const [edges, nodes, core] = masterCmds();
  const master = path.join(__dirname, '.icon-master.png');
  const mask = path.join(__dirname, '.icon-mask.png');
  try {
    // پس‌زمینۀ گرادیانی + گوشه‌های گرد (ماس)
    run(['-size', `${S}x${S}`, `gradient:${NAVY}-${TEAL}`, '-alpha', 'off', master]);
    run(['-size', `${S}x${S}`, 'xc:none', '-fill', 'white', '-draw', 'roundrectangle 0,0,511,511,108,108', mask]);
    run([master, mask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', master]);
    run([master, '-draw', edges, '-draw', nodes, '-draw', core, master]);
    for (const [name, size, extra] of [
      ['icon-192.png', 192, []],
      ['icon-512.png', 512, []],
      // ماسک‌بل: محتوا داخل ۸۰٪ امن می‌ماند و پس‌زمینهٔ یکدست دارد
      ['icon-maskable-512.png', 512, ['-resize', '80%', '-gravity', 'center', '-background', NAVY, '-flatten']],
      // iOS آیکون شفاف را پشت‌سیاه می‌کند → پس‌زمینۀ برند
      ['apple-touch-icon.png', 180, ['-background', NAVY, '-flatten']],
      ['favicon-32.png', 32, []],
      ['favicon-64.png', 64, []],
    ]) {
      const out = path.join(pub, name);
      const args = size === 512 && name === 'icon-512.png'
        ? [master, ...extra, out]
        : [master, '-resize', `${size}x${size}`, ...extra.filter((a) => a !== '-resize' && !/^\d+%$/.test(a)), out];
      try { run(args); made.push(name); } catch (e) { console.warn(`[gen-icons] ${name}: ${String(e.message).split('\n')[0]}`); }
    }
    // نسخهٔ ماسک‌بل: افکت گوشه لازم نیست؛ پس‌زمینۀ کامل
    try {
      run(['-size', `${S}x${S}`, `gradient:${NAVY}-${TEAL}`, '-alpha', 'off', '-draw', edges, '-draw', nodes, '-draw', core, path.join(pub, 'icon-maskable-512.png')]);
      if (!made.includes('icon-maskable-512.png')) made.push('icon-maskable-512.png');
    } catch { /* همان فایل قبلی می‌ماند */ }
  } catch (e) {
    console.warn('[gen-icons] ترسیم PNG ناموفق بود:', String(e.message).split('\n')[0]);
  } finally {
    fs.rmSync(master, { force: true }); fs.rmSync(mask, { force: true });
  }
} else {
  console.warn('[gen-icons] ImageMagick نیست — فقط icon.svg نوشته شد (manifest باز هم کار می‌کند)');
}

// manifest — مسیرها نسبی‌اند تا با basePath هر دو محیط (export و dev) درست حل شوند
const manifest = {
  name: 'هوش روابط راهبردی — SRIP',
  short_name: 'SRIP',
  description: 'ثبت روابط، امتیاز معیارمحور، تحلیل شبکه و توصیهٔ قدم بعدی',
  start_url: '.',
  scope: '.',
  display: 'standalone',
  orientation: 'any',
  dir: 'rtl',
  lang: 'fa',
  background_color: NAVY,
  theme_color: TEAL,
  icons: [
    { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'ثبت تعامل', url: './interactions?new=1' },
    { name: 'سازمان‌ها', url: './organizations' },
    { name: 'شبکه', url: './network' },
  ],
};
fs.writeFileSync(path.join(pub, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen-icons] public/: ${made.join(', ')} + manifest.webmanifest`);
