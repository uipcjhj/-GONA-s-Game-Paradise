/* 오프닝 v2 장면별 캡처 (자막이 다 나온 '대기' 상태) — 크롭·자막 가독성 검수용
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening2-frames.cjs <url(끝 /)> <outdir> [w] [h]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(url + '?preview&opening=2');
  await p.waitForSelector('.pv-box', { timeout: 60000 });
  await p.tap('.pv-opening');
  const state = () => p.evaluate(() => { const l = window.__osLog || []; return l[l.length - 1] || null; });
  const pages = 12;
  let lastScene = -1;
  for (let guard = 0; guard < 40; guard++) {
    let x = null;
    for (let k = 0; k < 200; k++) { x = await state(); if (x && x[2] === 'wait' && x[1] !== lastScene) break; await p.waitForTimeout(60); }
    if (!x) break;
    lastScene = x[1];
    await p.waitForTimeout(350);
    await p.screenshot({ path: `${out}/${w}x${h}-s${String(x[1]).padStart(2, '0')}.png` });
    if (x[1] >= pages - 1) break;
    if (x[1] === 5) continue; // 잠드는 장면은 스스로 넘어감
    await p.touchscreen.tap(+w / 2, +h * 0.4);
  }
  await b.close();
})();
