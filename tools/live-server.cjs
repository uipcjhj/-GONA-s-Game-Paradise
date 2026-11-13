#!/usr/bin/env node
/**
 * 두 앱을 **같은 출처(localhost:PORT)** 에서 함께 제공하는 로컬 테스트 서버 (운영 GitHub Pages 와 같은 구조)
 *   /-GONA-s-Game-Paradise/ → 게임천국 빌드,  /GoNa/ → Food Adventure 빌드
 *   node tools/live-server.cjs <paradiseDist> <foodDist> [port=8090] [foodProdDist]   (foodProdDist 가 있으면 /GoNa-prod/ 로도 제공)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const [pdir, fdir, port = '8090', fprod] = process.argv.slice(2);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const MOUNTS = [['/-GONA-s-Game-Paradise/', pdir], ['/GoNa/', fdir], ...(fprod ? [['/GoNa-prod/', fprod]] : [])];
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const m = MOUNTS.find(([p]) => u.startsWith(p));
  if (!m) { res.writeHead(404); return res.end('not found'); }
  let f = path.join(m[1], u.slice(m[0].length));
  if (!f.startsWith(path.resolve(m[1]))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
  const stat = fs.statSync(f);
  const range = req.headers.range;
  const type = MIME[path.extname(f)] || 'application/octet-stream';
  if (range) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Number(s); const end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': stat.size, 'accept-ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
}).listen(Number(port), () => console.log(`serving on http://localhost:${port}/`));
