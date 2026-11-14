/* GONA's Sky Adventure 자동 검수: 모바일 뷰포트 스크린샷 + 콘솔 오류 + 동료별 플레이 시뮬레이션
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-shots.cjs http://localhost:4173/ out-dir */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'shots-sky';
fs.mkdirSync(out, { recursive: true });
const sizes = [[393, 636], [390, 844]];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(`${w}x${h} ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${w}x${h} PAGEERR ${e.message}`));
    await page.goto(`${base}?skytest#sky`);
    await page.waitForSelector('.sel-art');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/sky-select-${w}x${h}.png` });
    await page.click('.sky-card:nth-child(1)', { force: true }).catch(() => {});
    await page.click('.sky-btn-go');
    await page.waitForSelector('.sky-canvas');
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/sky-play-intro-${w}x${h}.png` });
    const box = await (await page.$('.sky-canvas')).boundingBox();
    // 드래그 이동 (터치와 같은 pointer 이벤트)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
    await page.mouse.down();
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(box.x + box.width * (0.5 + 0.35 * Math.sin(i / 6)), box.y + box.height * (0.8 - 0.05 * Math.cos(i / 4)));
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => { window.__sky.cheat('power'); window.__sky.cheat('god'); });
    for (let i = 0; i < 60; i++) {
      await page.mouse.move(box.x + box.width * (0.5 + 0.35 * Math.sin(i / 6)), box.y + box.height * 0.8);
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `${out}/sky-play-mid-${w}x${h}.png` });
    console.log(w, h, JSON.stringify(await page.evaluate(() => window.__sky.debug())));
    await page.evaluate(() => window.__sky.cheat('boss'));
    for (let i = 0; i < 70; i++) {
      await page.mouse.move(box.x + box.width * (0.5 + 0.3 * Math.sin(i / 5)), box.y + box.height * 0.8);
      await page.waitForTimeout(100);
    }
    await page.screenshot({ path: `${out}/sky-boss-${w}x${h}.png` });
    console.log('boss', JSON.stringify(await page.evaluate(() => window.__sky.debug())));
    await page.mouse.up();
    await ctx.close();
  }
  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})();
