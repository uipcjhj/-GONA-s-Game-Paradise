/* 동료 5종 · 보스 클리어 · 게임오버 · 재시작 · 월드맵 복귀 흐름 검사 */
const { chromium } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'shots-sky';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  const drag = async (box, sec) => {
    for (let i = 0; i < sec * 10; i++) {
      await page.mouse.move(box.x + box.width * (0.5 + 0.3 * Math.sin(i / 6)), box.y + box.height * 0.78);
      await page.waitForTimeout(100);
    }
  };
  for (let f = 1; f <= 5; f++) {
    await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
    await page.waitForSelector('.sel-art');
    await page.click(`.sky-card >> nth=${f - 1}`);
    await page.click('.sky-btn-go');
    await page.waitForSelector('.sky-canvas');
    const box = await (await page.$('.sky-canvas')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.78);
    await page.mouse.down();
    await page.evaluate(() => window.__sky.cheat('power'));
    await drag(box, 9);
    await page.screenshot({ path: `${out}/sky-fam${f}.png` });
    console.log('fam', f, JSON.stringify(await page.evaluate(() => window.__sky.debug())));
    await page.mouse.up();
  }
  // 차지샷 + 폭탄
  await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
  await page.waitForSelector('.sel-art');
  await page.click('.sky-btn-go');
  await page.waitForSelector('.sky-canvas');
  const box = await (await page.$('.sky-canvas')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.78);
  await page.mouse.down();
  await drag(box, 4);
  await page.mouse.up();
  const ch = await page.$('.sky-charge'); const cb = await ch.boundingBox();
  await page.mouse.move(cb.x + 10, cb.y + 10); await page.mouse.down(); await page.waitForTimeout(1100);
  await page.screenshot({ path: `${out}/sky-charging.png` });
  await page.mouse.up(); await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/sky-chargeshot.png` });
  const bb = await (await page.$('.sky-bomb')).boundingBox();
  await page.mouse.click(bb.x + 10, bb.y + 10); await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/sky-bomb.png` });
  console.log('after bomb', JSON.stringify(await page.evaluate(() => window.__sky.debug())));
  // 일시정지
  await page.click('.sky-pause'); await page.waitForSelector('.sky-overlay');
  await page.screenshot({ path: `${out}/sky-pause.png` });
  await page.click('text=계속하기');
  // 게임오버
  await page.evaluate(() => window.__sky.cheat('hp1'));
  await page.waitForSelector('text=다시 도전', { timeout: 40000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/sky-gameover.png` });
  await page.click('text=다시 도전!'); await page.waitForTimeout(800);
  console.log('restart', JSON.stringify(await page.evaluate(() => window.__sky.debug())));
  // 보스 클리어
  await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('power'); window.__sky.cheat('boss'); });
  const box2 = await (await page.$('.sky-canvas')).boundingBox();
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.78); await page.mouse.down();
  for (let i = 0; i < 200; i++) {
    await page.mouse.move(box2.x + box2.width * (0.5 + 0.3 * Math.sin(i / 6)), box2.y + box2.height * 0.78);
    await page.waitForTimeout(100);
    const d = await page.evaluate(() => window.__sky.debug());
    if (d.boss > 0 && d.boss < 400) { await page.evaluate(() => window.__sky.cheat('killboss')); break; }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/sky-bossdie.png` });
  await page.waitForSelector('text=STAGE CLEAR', { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/sky-clear.png` });
  await page.mouse.up();
  await page.click('text=월드맵으로');
  await page.waitForTimeout(500);
  console.log('map visible:', await page.locator('.frame').count(), 'hash:', await page.evaluate(() => location.hash || '(none)'));
  await page.screenshot({ path: `${out}/sky-backtomap.png` });
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})();
