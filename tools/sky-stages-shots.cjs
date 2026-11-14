/* 전 스테이지 화면 검수: 스테이지별 시작 · 중간보스 · 보스 · 보스 최종 단계 + 결산 · 컨티뉴 · 엔딩 · 크레딧
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-stages-shots.cjs <url> <outdir> [w] [h] */
const { chromium } = require('playwright');
const [url, out, W = '390', H = '844'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const shot = (n) => page.screenshot({ path: `${out}/${W}x${H}-${n}.png` });
  await page.goto(url); await page.waitForSelector('.ttl-start'); await page.tap('.ttl-start'); await page.waitForSelector('.sel-art'); await page.waitForTimeout(600);
  await shot('00-select');
  for (let st = 1; st <= 6; st++) {
    await page.evaluate((s) => window.__skyFlow.start(s, 'normal'), st);
    await page.waitForFunction((s) => window.__sky && window.__sky.debug().stage === s && document.querySelector('.sky-canvas'), st, { timeout: 30000 });
    await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('auto'); });
    await page.waitForTimeout(1500); await shot(`s${st}-1-intro`);
    await page.waitForTimeout(9000); await shot(`s${st}-2-waves`);
    await page.evaluate(() => window.__sky.cheat('midboss'));
    await page.waitForTimeout(6500); await shot(`s${st}-3-midboss`);
    await page.evaluate(() => { window.__sky.cheat('killmid'); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__sky.cheat('boss'));
    await page.waitForTimeout(2000); await shot(`s${st}-4-warning`);
    await page.waitForTimeout(9000); await shot(`s${st}-5-boss`);
    await page.evaluate(() => { const s = window.__sky; if (s.boss) { for (const e of s.en) if (e.kind === 'part') e.dead = true; s.boss.hp = s.boss.max * 0.3; } });
    await page.waitForTimeout(5500); await shot(`s${st}-6-boss-final`);
    const d = await page.evaluate(() => window.__sky.debug());
    console.log('stage', st, JSON.stringify({ t: d.t, eb: d.ebullets, fps: d.fps, phase: d.phase }));
    if (st === 1) {
      await page.evaluate(() => window.__sky.cheat('killboss'));
      await page.waitForSelector('.tally', { timeout: 20000 }); await page.waitForTimeout(500); await shot('s1-7-tally');
    }
    if (st === 2) {
      await page.evaluate(() => { const s = window.__sky; s.hp = 1; s.cheat('hurt'); });
      await page.waitForSelector('.cont', { timeout: 20000 }); await page.waitForTimeout(500); await shot('s2-7-continue');
    }
    if (st === 6) {
      await page.evaluate(() => window.__sky.cheat('killboss'));
      await page.waitForSelector('.end-pic', { timeout: 30000 }); await page.waitForTimeout(1200); await shot('e1-ending');
      for (let i = 0; i < 2; i++) { await page.tap('.end'); await page.waitForTimeout(900); }
      await shot('e2-ending-family');
      for (let i = 0; i < 3; i++) { await page.tap('.end'); await page.waitForTimeout(400); }
      await page.waitForSelector('.cred-scroll'); await page.waitForTimeout(9000); await shot('e3-credits');
    }
  }
  console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
})();
