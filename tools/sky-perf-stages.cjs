/* 전 스테이지 보스 최종 단계 스트레스 측정: iPhone 13 화면(DPR 3) + CPU 스로틀
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-perf-stages.cjs <url> [throttle] [secs] */
const { chromium, devices } = require('playwright');
const [url, thr = '6', secs = '10'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(url); await page.waitForSelector('.ttl-start'); await page.tap('.ttl-start'); await page.waitForSelector('.sel-art');
  for (let st = 1; st <= 6; st++) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate((s) => window.__skyFlow.start(s, 'hard'), st);
    await page.waitForFunction((s) => window.__sky && window.__sky.debug().stage === s && document.querySelector('.sky-canvas'), st, { timeout: 30000 });
    await page.evaluate(() => { const s = window.__sky; s.cheat('god'); s.cheat('power'); s.cheat('auto'); s.cheat('boss'); });
    await page.waitForFunction(() => { const d = window.__sky.debug(); return d.block === 'boss' && d.boss > 0; }, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__sky.cheat('stress'));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +thr });
    await page.evaluate(() => { window.__ft = []; let l = performance.now(); const f = (n) => { window.__ft.push(n - l); l = n; if (window.__ft.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    let maxEb = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < +secs * 1000) { const d = await page.evaluate(() => window.__sky.debug()); maxEb = Math.max(maxEb, d.ebullets); await page.waitForTimeout(250); }
    const ft = (await page.evaluate(() => window.__ft)).slice(5).sort((a, b) => a - b);
    const avg = ft.reduce((a, c) => a + c, 0) / ft.length;
    const d = await page.evaluate(() => window.__sky.debug());
    console.log(JSON.stringify({ stage: st, cpu: thr + 'x', fps: +(1000 / avg).toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), worst: +ft[ft.length - 1].toFixed(1), over20: ft.filter((x) => x > 20).length, frames: ft.length, maxEb, upd: d.upd, drw: d.drw }));
    await page.evaluate(() => { window.__ft.length = 100000; });
  }
  await b.close();
})();
