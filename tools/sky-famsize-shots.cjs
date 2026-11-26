/* 동료 6명 화면상 크기 비교: 같은 스테이지 · 같은 위치 · 같은 시각에 고나+동료 부분을 잘라 나란히
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-famsize-shots.cjs <url(끝 /)> <out.png> [label]
 */
const { chromium } = require('playwright');
const [url, out, label = ''] = process.argv.slice(2);
const FAM = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
(async () => {
  const b = await chromium.launch();
  const shots = [];
  for (const f of FAM) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript((fam) => { localStorage.setItem('gona.skyadv.opened', '1'); localStorage.setItem('gona.skyadv.fam', fam); }, f);
    const p = await ctx.newPage();
    await p.goto(url + '?skytest');
    await p.waitForSelector('.ttl-start', { timeout: 60000 });
    await p.evaluate(() => window.__skyFlow.start(1, 'normal'));
    await p.waitForFunction(() => window.__sky && document.querySelector('.sky-canvas'));
    await p.evaluate(() => { const s = window.__sky; s.cheat('god'); });
    for (let i = 0; i < 30; i++) { if (await p.$('.sky-talk')) await p.tap('.sky-talk', { position: { x: 20, y: 20 } }).catch(() => {}); await p.waitForTimeout(100); }
    await p.waitForTimeout(400);
    await p.evaluate(() => { const s = window.__sky; s.en.length = 0; s.eb.length = 0; s.px = 90; s.py = 230; s.targetX = 90; s.targetY = 230; s.hasTarget = false; s.cx = 62; s.cy = 246; s.setPaused(true); });
    await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelectorAll('.sky-overlay').forEach((e) => (e.style.display = 'none')); });
    const r = await p.$eval('.sky-canvas', (e) => { const q = e.getBoundingClientRect(); return [q.x, q.y, q.width / 180]; });
    const buf = await p.screenshot({ clip: { x: r[0] + 20 * r[2], y: r[1] + 175 * r[2], width: 110 * r[2], height: 100 * r[2] } });
    shots.push([f, buf.toString('base64')]);
    await ctx.close();
  }
  require('fs').writeFileSync(out + '.json', JSON.stringify({ label, shots }));
  await b.close();
})();
