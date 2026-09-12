/* شبیه‌ساز رفتار GitHub Pages برای بیلد استاتیک — همان قواعد مسیریابی:
   /foo → foo.html (اگر باشد) یا foo/index.html؛ وگرنه 404.html با وضعیت ۴۰۴ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2] ?? '/home/user/Srip/docs/srip2';
/* GitHub Pages فایل 404.html را فقط از «ریشهٔ سایت» (docs/) سرو می‌کند — نه از
   زیرپوشه‌ها. شبیه‌ساز هم همین‌طور عمل می‌کند تا باگ‌های کلاس ۴۰۴ِ ریشه (مثل
   حلقهٔ ریدایرکت نسبی /srip2/srip2/…) در تست‌ها دیده شوند. */
const siteRoot = path.resolve(root, '..');
const base = '/Srip/srip2';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!p.startsWith(base)) { res.writeHead(302, { Location: base + '/' }); return res.end(); }
  p = p.slice(base.length) || '/';
  let f = path.join(root, p);
  let code = 200;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    const idx = path.join(f, 'index.html');
    const flat = f + '.html';
    if (fs.existsSync(idx)) f = idx;
    else if (fs.existsSync(flat)) f = flat;
    else { f = path.join(siteRoot, '404.html'); code = 404; }
  } else if (!fs.existsSync(f)) {
    const flat = f + '.html';
    if (fs.existsSync(flat) && !p.endsWith('/')) f = flat;
    else { f = path.join(siteRoot, '404.html'); code = 404; }
  }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(code, { 'Content-Type': mime[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4100, '0.0.0.0', () => console.log('gh-pages-like on 4100'));
