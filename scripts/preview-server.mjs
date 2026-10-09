// Live preview server: serves docs/ (static export) under /Srip basePath,
// mirroring the GitHub Pages layout. Also proxies /api to the mock when absent.
import { createServer } from 'node:http';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../docs/', import.meta.url).pathname;
const MOCK = { host: '127.0.0.1', port: Number(process.env.MOCK_API_PORT || 4000) };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function proxyApi(req, res, apiPath) {
  const target = http.request(
    { host: MOCK.host, port: MOCK.port, method: req.method, path: apiPath, headers: { ...req.headers, host: `${MOCK.host}:${MOCK.port}` } },
    (up) => { res.writeHead(up.statusCode ?? 502, up.headers); up.pipe(res); },
  );
  target.on('error', () => { res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ message: 'mock-api در دسترس نیست (:4000)' })); });
  req.pipe(target);
}

createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.startsWith('/Srip')) urlPath = urlPath.slice('/Srip'.length) || '/';
    // API fallback for non-SW browsers/preview — mirrors what public/sw.js answers.
    if (urlPath.startsWith('/api/v1')) return proxyApi(req, res, urlPath);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    /* فونت ریشه‌مطلق CSS (url(/fonts/…)) — در استقرار ریشهٔ Plesk از خود سایت
       سرو می‌شود؛ اینجا هم به نسخهٔ داخل اپ نگاشت می‌کنیم تا رفتار یکسان باشد. */
    if (urlPath.startsWith('/fonts/')) urlPath = '/srip2' + urlPath;
    let file = join(ROOT, normalize(urlPath));
    // try exact, then .html (clean URLs like /people -> people.html), then dir/index.html
    let st;
    try { st = await stat(file); } catch { file += '.html'; st = await stat(file); }
    if (st.isDirectory()) {
      try { file = join(file, 'index.html'); st = await stat(file); }
      catch { file = file.slice(0, -'/index.html'.length) + '.html'; st = await stat(file); }
    }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  } catch (e) {
    /* مثل GitHub Pages و ErrorDocument 404 /404.html در Plesk:
       مسیر گمشده → 404.html اپ (که با منطق Not-found هوشمند به /view هدایت می‌کند) */
    const wantsHtml = String(req.headers.accept ?? '').includes('text/html');
    if (wantsHtml) {
      try {
        const buf = await readFile(join(ROOT, 'srip2', '404.html'));
        res.writeHead(404, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(buf);
        return;
      } catch {}
    }
    console.error('[404]', req.url, e?.message ?? e);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(Number(process.env.PREVIEW_PORT || 8931), '0.0.0.0', () => console.log(`preview on :${process.env.PREVIEW_PORT || 8931} serving /Srip`));
