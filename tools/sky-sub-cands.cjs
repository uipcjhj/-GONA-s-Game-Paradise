/* 한글 부제 레터링 시안 비교: 실제 타이틀 화면에서 (영문 로고 × 부제) 조합 캡처
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-sub-cands.cjs <url(끝 /)> <outdir> [조합 목록: E1,E2,A1 ...]
 */
const { chromium } = require('playwright');
const [url, out, list] = process.argv.slice(2);
const combos = (list || 'NOW,E1,E2,E3,E4,A1,B4,C3,F4').split(',');
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    for (const c of combos) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript(() => localStorage.setItem('gona.skyadv.opened', '1'));
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(url + '?skytest' + (c === 'NOW' ? '' : `&logo=${c[0]}&sub=${c.slice(1)}`));
      await p.waitForSelector('.ttl-start', { timeout: 60000 });
      await p.waitForTimeout(2600);
      await p.evaluate(() => { const n = document.querySelector('.cand-pick'); if (n) n.style.display = 'none'; });
      await p.screenshot({ path: `${out}/${w}x${h}-${c}.png` });
      if (errs.length) console.log(c, errs[0]);
      await ctx.close();
    }
  }
  await b.close();
})();
