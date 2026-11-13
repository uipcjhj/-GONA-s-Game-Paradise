/* 플레이 녹화: 영상(webm, Playwright recordVideo) + GIF용 프레임(캔버스 캡처)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-record.cjs <url> <out> [fam] */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const [base = 'http://localhost:4173/', out = 'rec', fam = 'imo'] = process.argv.slice(2);
fs.mkdirSync(`${out}/frames`, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], recordVideo: { dir: out, size: { width: 390, height: 664 } } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}?skytest&r=1#sky`); await page.waitForSelector('.sel-art');
  await page.evaluate((f) => { try { localStorage.setItem('gona.sky.fam', f); } catch (e) {} }, fam);
  await page.goto(`${base}?skytest&r=2#sky`); await page.waitForSelector('.sel-art'); await page.waitForTimeout(1500);
  await page.tap('.sky-btn-go'); await page.waitForSelector('.sky-canvas');
  await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('bombs'); window.__sky.cheat('power'); });
  const box = await (await page.$('.sky-canvas')).boundingBox();
  const P = (x, y, id = 0) => ({ x: box.x + (x / 180) * box.width, y: box.y + (y / 320) * box.height, id });
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await touch('touchStart', [P(90, 250)]);
  let n = 0, i = 0;
  const cb = await (await page.$('.sky-charge')).boundingBox(); const C = { x: cb.x + 20, y: cb.y + 15, id: 1 };
  const bb = await (await page.$('.sky-bomb')).boundingBox(); const Bm = { x: bb.x + 20, y: bb.y + 15, id: 2 };
  const step = async (secs, extra) => {
    const t0 = Date.now();
    while (Date.now() - t0 < secs * 1000) {
      i++;
      const f = P(90 + 58 * Math.sin(i / 11), 245 - 18 * Math.sin(i / 17));
      if (extra) await extra(f); else await touch('touchMove', [f]);
      if (i % 2 === 0) await page.screenshot({ path: `${out}/frames/f${String(n++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 80, clip: box });
      await page.waitForTimeout(20);
    }
  };
  await step(12);                                     // 편대·포탑
  const f0 = P(90, 245);
  await touch('touchStart', [f0, C]); await step(1.2, async (f) => touch('touchMove', [f, C]));   // 차지
  await touch('touchEnd', [C]); await step(1.5);
  await touch('touchStart', [P(90, 245), Bm]); await touch('touchEnd', [Bm]); await step(2.5);      // 폭탄
  await page.evaluate(() => window.__sky.cheat('boss'));
  await step(13);                                     // 경고 → 보스전
  await page.evaluate(() => window.__sky.cheat('killboss'));
  await step(4);                                      // 보스 격파 · 클리어
  await ctx.close(); await b.close();
  console.log('frames', n);
})();
