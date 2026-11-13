/* 스테이지 1 플레이 캡처: iPhone 13 에뮬레이션, CDP 터치로 좌우 이동하며 시점별 스크린샷
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-stage1-shots.cjs <url> <out> [fam] [times...] */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const [base = 'http://localhost:4173/', out = 'shots-s1', fam = 'mom', ...ts] = process.argv.slice(2);
const times = ts.length ? ts.map(Number) : [3, 11, 16, 22, 31, 56, 63, 72];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
  await page.waitForSelector('.sel-art');
  await page.evaluate((f) => { try { localStorage.setItem('gona.sky.fam', f); } catch (e) {} }, fam);
  await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
  await page.waitForSelector('.sky-btn-go');
  await page.tap('.sky-btn-go');
  await page.waitForSelector('.sky-canvas');
  await page.evaluate(() => { window.__sky.cheat('god'); });
  const box = await (await page.$('.sky-canvas')).boundingBox();
  const P = (x, y) => ({ x: box.x + (x / 180) * box.width, y: box.y + (y / 320) * box.height, id: 0 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(90, 250)] });
  let i = 0;
  for (const T of times) {
    while (true) {
      const d = await page.evaluate(() => window.__sky.debug());
      if (d.t >= T || d.over) break;
      i++;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(90 + 55 * Math.sin(i / 14), 250 - 12 * Math.sin(i / 23))] });
      await page.waitForTimeout(50);
    }
    await page.screenshot({ path: `${out}/t${String(T).padStart(2, '0')}.png` });
    console.log('shot', T, JSON.stringify(await page.evaluate(() => window.__sky.debug())));
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
