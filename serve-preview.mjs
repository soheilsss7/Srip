// Preview server for the static export of /Srip + /Srip/srip2 under docs/
// Rewrites any incoming path that starts with /Srip to docs/<rest>,
// so the absolute basePath URLs (/Srip/srip2/_next/...) work locally.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/user/Srip/docs";
const PORT = process.env.PORT || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".xml": "text/xml",
  ".wasm": "application/wasm",
};

const LANDING = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>پیش‌نمایش SRIP</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: Vazirmatn, "Segoe UI", Tahoma, system-ui, sans-serif;
    background: linear-gradient(160deg, #eef1ff, #f6f2ff 60%, #fff);
  }
  main { padding: 32px; text-align: center; max-width: 760px; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  p.sub { opacity: .75; margin: 0 0 28px; font-size: 14px; line-height: 2; }
  .cards { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  a.card {
    display: block; text-decoration: none; color: inherit; text-align: right;
    background: #fff; border: 1px solid rgba(16,24,40,.12); border-radius: 18px;
    padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px -12px rgba(20,20,70,.18);
    transition: transform .12s, box-shadow .12s;
  }
  a.card:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgba(16,24,40,.08), 0 20px 44px -14px rgba(20,20,70,.25); }
  a.card .tag { display:inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-bottom: 10px; }
  .v-new .tag { background:#eef1ff; color:#3d4fd8; border:1px solid #cdd4ff; }
  .v-old .tag { background:#f1f1f4; color:#555; border:1px solid #ddd; }
  a.card h2 { margin: 0 0 6px; font-size: 17px; }
  a.card p { margin: 0; font-size: 12.5px; line-height: 1.9; opacity: .7; }
  .hint { margin-top: 22px; font-size: 11.5px; opacity: .55; }
  @media (prefers-color-scheme: dark) {
    body { background: linear-gradient(160deg, #14162a, #1c1830 60%, #131318); color:#e8e8f2; }
    a.card { background:#1b1d2e; border-color: rgba(148,163,184,.18); }
  }
</style>
</head>
<body>
<main>
  <h1>پیش‌نمایش SRIP</h1>
  <p class="sub">دو نسخه در دسترس است — نسخهٔ جدید (UI 3.0) را با نسخهٔ اصلی مقایسه کنید.<br>ورود دمو در هر دو: <b>demo</b> / <b>123456</b></p>
  <div class="cards">
    <a class="card v-new" href="/Srip/srip2/login.html">
      <span class="tag">نسخهٔ جدید — UI 3.0 (کلون)</span>
      <h2>srip2 · رابط بازطراحی‌شده</h2>
      <p>کروم آرام، فونت وزیرمتن، کارت و جدول مدرن، تم روشن/تیره<br><b>demo / 123456</b></p>
    </a>
    <a class="card v-old" href="/Srip/login.html">
      <span class="tag">نسخهٔ اصلی (دست‌نخورده)</span>
      <h2>SRIP · نسخهٔ فعلی</h2>
      <p>همان ظاهر پیشین برای مقایسه<br><b>demo / 123456</b></p>
    </a>
  </div>
  <div class="hint">نسخهٔ لایو GitHub Pages: <a href="https://soheilsss7.github.io/Srip/srip2/">soheilsss7.github.io/Srip/srip2</a></div>
</main>
</body>
</html>`;

function send404(res, base) {
  // last resort: relative 404 page of that sub-app if exists
  const parts = path.dirname(base).split(path.sep).filter(Boolean);
  let rel404 = path.join(ROOT, ...parts, "404.html");
  if (parts[0] === "srip2") rel404 = path.join(ROOT, "srip2", "404.html");
  fs.stat(rel404, (e4, s4) => {
    if (!e4 && s4.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(rel404).pipe(res);
    } else {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — فایل یافت نشد");
    }
  });
}

function sendFile(res, absPath) {
  fs.readFile(absPath, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — فایل یافت نشد");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(absPath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(buf);
  });
}

function resolveFromDocs(urlPath) {
  // strip query
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/\/+/g, "/");
  let rel = clean;
  if (rel.startsWith("/Srip")) rel = rel.slice("/Srip".length) || "/";
  rel = rel.replace(/^\/+/, "");
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null;
  return { abs, isDir: false, rel };
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || "/";
  if (urlPath === "/" || urlPath === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    res.end(LANDING);
    return;
  }
  let target = resolveFromDocs(urlPath);
  if (!target) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("forbidden");
    return;
  }
  const base = target.abs; // original resolved path (before dir/index handling)
  fs.stat(base, (err, st) => {
    if (!err && st.isDirectory()) {
      // GitHub Pages style: try index.html, then <dirname>.html for pretty URLs
      const idx = path.join(base, "index.html");
      fs.stat(idx, (e2, s2) => {
        if (!e2 && s2.isFile()) return sendFile(res, idx);
        fs.stat(base + ".html", (e3, s3) => {
          if (!e3 && s3.isFile()) return sendFile(res, base + ".html");
          return send404(res, base);
        });
      });
      return;
    }
    if (!err && st.isFile()) return sendFile(res, base);
    // extension-less GitHub Pages behaviour: try adding .html
    fs.stat(base + ".html", (err3, st3) => {
      if (!err3 && st3.isFile()) return sendFile(res, base + ".html");
      return send404(res, base);
    });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SRIP preview listening on http://0.0.0.0:${PORT}`);
  console.log(`Landing: /  |  جدید: /Srip/srip2/login.html  |  اصلی: /Srip/login.html`);
});
