#!/usr/bin/env node
// ============================================================================
//  E2E browser bootstrap — بدون هیچ دانلود خارج از npm
//  · Chromium 149 از بستهٔ @sparticuz/chromium (داخل tarball نصب npm)
//  · کتابخانه‌های NSS/NSPR (libnss3/libnssutil3/libnspr4/…) از لایهٔ
//    Amazon Linux 2023 همان بسته (bin/al2023.tar.br) — دیگر «منبع‌ساز» لازم نیست.
//  خروجی:
//    .e2e-browser/chromium   — باینری کروم
//    .e2e-browser/nss/…      — .so های NSS
//  سپس E2E را با این دو متغیر اجرا کنید:
//    CHROME_EXE=.e2e-browser/chromium CHROME_LD=.e2e-browser/nss
// ============================================================================
import { createBrotliDecompress } from 'node:zlib';
import { createReadStream, createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '.e2e-browser');

function binDir() {
  const argv = process.argv[2];
  if (argv) return resolve(argv);
  const cand = [join(HERE, '..', 'node_modules', '@sparticuz', 'chromium', 'bin')];
  for (const c of cand) if (existsSync(join(c, 'chromium.br'))) return c;
  console.error('[e2e-setup] bin/@sparticuz/chromium یافت نشد.');
  console.error('  نصب:  npm i -D @sparticuz/chromium   (یا: pnpm add -D @sparticuz/chromium)');
  process.exit(1);
}

/** Brotli -> plain file (chromium.br) یا plain tar (al2023.tar.br). */
function brotliTo(file, out) {
  return new Promise((resolveP, reject) => {
    const src = createReadStream(file);
    const dec = createBrotliDecompress({ chunkSize: 2 ** 21 });
    const dst = createWriteStream(out, { mode: 0o700 });
    src.once('error', reject);
    dec.once('error', reject);
    dst.once('error', reject);
    dst.once('close', () => resolveP(out));
    src.pipe(dec).pipe(dst);
  });
}

const bin = binDir();
mkdirSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'nss'), { recursive: true });

const chromiumExe = join(OUT, 'chromium');
const nssTar = join(OUT, 'nss.tar');
const nssDir = join(OUT, 'nss');

if (!existsSync(chromiumExe)) {
  console.log('[e2e-setup] extracting chromium…');
  await brotliTo(join(bin, 'chromium.br'), chromiumExe);
}

if (!existsSync(join(nssDir, 'libnss3.so'))) {
  console.log('[e2e-setup] extracting NSS/NSPR from al2023 layer…');
  await brotliTo(join(bin, 'al2023.tar.br'), nssTar);
  // tar ساده است؛ از tar سیستم استفاده می‌کنیم تا وابستگی خارجی اضافه نشود.
  execFileSync('tar', ['xf', nssTar, '-C', nssDir, '--strip-components=1', 'lib'], { stdio: 'inherit' });
  rmSync(nssTar, { force: true });
}

// SwiftShader (libGLESv2/libEGL/vk_swiftshader) — کروم این‌ها را کنار باینری‌اش
// پیدا می‌کند؛ بدون آن‌ها در مسیرهای غیر از /tmp پروسهٔ مرورگر بالا نمی‌آید.
const swTar = join(OUT, 'swiftshader.tar');
if (!existsSync(join(OUT, 'libGLESv2.so'))) {
  console.log('[e2e-setup] extracting swiftshader (GL) next to chromium…');
  await brotliTo(join(bin, 'swiftshader.tar.br'), swTar);
  execFileSync('tar', ['xf', swTar, '-C', OUT], { stdio: 'inherit' });
  rmSync(swTar, { force: true });
}

if (!existsSync(chromiumExe) || !existsSync(join(nssDir, 'libnss3.so'))) {
  console.error('[e2e-setup] استخراج ناقص بود.');
  process.exit(1);
}

console.log('----');
console.log(`CHROME_EXE=${chromiumExe}`);
console.log(`CHROME_LD=${nssDir}`);
console.log('----');
console.log('سپس:  CHROME_EXE=<…> CHROME_LD=<…> node scripts/e2e/publics-ui.mjs');
