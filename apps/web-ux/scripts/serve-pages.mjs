import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/user/Srip/docs/srip2';
const SITE_ROOT = path.resolve(ROOT, '..');
const BASE = '/Srip/srip2';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (p.startsWith('/api/v1')) return proxy(req, res);
  if (!p.startsWith(BASE)) { res.writeHead(302, { Location: BASE + '/' }); return res.end(); }
  p = p.slice(BASE.length) || '/';
  let f = path.join(ROOT, p);
  let code = 200;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    const idx = path.join(f, 'index.html');
    const flat = f + '.html';
    if (fs.existsSync(idx)) f = idx;
    else if (fs.existsSync(flat)) f = flat;
    else { f = path.join(SITE_ROOT, '404.html'); code = 404; }
  } else if (!fs.existsSync(f)) {
    const flat = f + '.html';
    if (fs.existsSync(flat) && !p.endsWith('/')) f = flat;
    else { f = path.join(SITE_ROOT, '404.html'); code = 404; }
  }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(code, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4100, '0.0.0.0', () => console.log('[pages-4100] up'));
function proxy(req, res) {
  const opts = { hostname: '127.0.0.1', port: 4300, path: req.url, method: req.method, headers: { ...req.headers, host: '127.0.0.1:4300' } };
  const up = http.request(opts, r => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
  up.on('error', () => { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'mock 4300 در دسترس نیست' })); });
  req.pipe(up);
}
