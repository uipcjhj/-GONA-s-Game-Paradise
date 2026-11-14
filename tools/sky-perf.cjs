// 보스 최악 상황(3단계·탄막 최대) 프레임 측정: iPhone 13 에뮬(DPR 3) + CPU 스로틀
const { chromium, devices } = require('playwright');
const [url, label, thr = '4', secs = '14'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url);
  await page.waitForSelector('.sel-art, .ttl-start', { timeout: 20000 });
  if (await page.$('.ttl-start')) { await page.tap('.ttl-start'); await page.waitForSelector('.sel-art'); }
  await page.tap('.sky-btn-go'); await page.waitForSelector('.sky-canvas'); await page.waitForTimeout(800);
  await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('boss'); });
  for (let i = 0; i < 80; i++) { const d = await page.evaluate(() => window.__sky.debug()); if (d.boss > 0 && d.t > 60) break; await page.waitForTimeout(150); }
  await page.evaluate(() => { const s = window.__sky; s.boss.hp = s.boss.max * 0.3; s.boss.max = 1e6; s.boss.hp = 300000; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +thr });
  const box = await (await page.$('.sky-canvas')).boundingBox();
  const P = (x, y) => ({ x: box.x + (x / 180) * box.width, y: box.y + (y / 320) * box.height, id: 0 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(90, 250)] });
  await page.evaluate(() => { window.__ft = []; let l = performance.now(); const f = (n) => { window.__ft.push(n - l); l = n; if (window.__ft.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  let maxEb = 0;
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < +secs * 1000) { i++; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(90 + 60 * Math.sin(i / 8), 250 + 20 * Math.cos(i / 11))] }); const d = await page.evaluate(() => window.__sky.debug()); maxEb = Math.max(maxEb, d.ebullets); await page.waitForTimeout(100); }
  const ft = (await page.evaluate(() => window.__ft)).slice(5).sort((a, b) => a - b);
  const avg = ft.reduce((a, b) => a + b, 0) / ft.length;
  const pct = (p) => ft[Math.floor(ft.length * p)].toFixed(1);
  const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1));
  const dbg = await page.evaluate(() => window.__sky.debug()); console.error('internal', JSON.stringify({upd: dbg.upd, drw: dbg.drw}));
  const r = { label, cpuThrottle: thr + 'x', frames: ft.length, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p50: +pct(0.5), p95: +pct(0.95), p99: +pct(0.99), worst: +ft[ft.length - 1].toFixed(1), over20ms: ft.filter((x) => x > 20).length, over33ms: ft.filter((x) => x > 33).length, maxEnemyBullets: maxEb, heapMB: heap, canvas: dbg.S };
  console.log(JSON.stringify(r));
  await page.screenshot({ path: `${process.env.OUT || '.'}/perf-${label}.png` });
  await b.close();
})();
