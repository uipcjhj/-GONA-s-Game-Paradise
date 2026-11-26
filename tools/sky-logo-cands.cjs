/* 타이틀 로고 시안 비교판: 현재 로고 + A~F 를 실제 타이틀 화면에서 캡처
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-logo-cands.cjs <url(끝 /)> <outdir>
 */
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    for (const c of ['NOW', 'A', 'B', 'C', 'D', 'E', 'F']) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
      const p = await ctx.newPage();
      await p.goto(url + '?skytest' + (c === 'NOW' ? '' : `&logo=${c}`));
      await p.waitForSelector('.ttl-start', { timeout: 60000 });
      await p.waitForTimeout(2600);
      await p.evaluate(() => { const n = document.querySelector('.cand-pick'); if (n) n.style.display = 'none'; });
      await p.screenshot({ path: `${out}/${w}x${h}-${c}.png` });
      await ctx.close();
    }
  }
  await b.close();
})();
