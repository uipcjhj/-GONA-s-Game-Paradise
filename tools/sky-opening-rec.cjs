/* 오프닝 실속도 녹화 + 2초 간격 프레임 (개발자 미리보기 ?preview 로 · 기록 저장 없음)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-opening-rec.cjs <url(끝 /)> <outdir> [w] [h]
 *  → outdir/opening-<w>x<h>.webm · outdir/f-XX.png (0,2,4,…44초)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const [url, out, w = '393', h = '636'] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: +w, height: +h } } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url + '?preview');
  await p.waitForSelector('.pv-box', { timeout: 60000 });
  await p.tap('.pv-opening');
  await p.waitForSelector('.oc-canvas', { timeout: 30000 });
  await p.waitForFunction(() => !document.querySelector('.oc-loading'), null, { timeout: 30000 });
  const t0 = Date.now();
  for (let s = 0; s <= 44; s += 2) {
    const wait = t0 + s * 1000 - Date.now();
    if (wait > 0) await p.waitForTimeout(wait);
    await p.screenshot({ path: `${out}/f-${String(s).padStart(2, '0')}.png` });
  }
  await p.waitForTimeout(1500);
  const v = p.video();
  await ctx.close();
  fs.renameSync(await v.path(), `${out}/opening-${w}x${h}.webm`);
  console.log('녹화 완료', `${out}/opening-${w}x${h}.webm`, '오류', errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
})();
