#!/usr/bin/env node
/**
 * 실제 플레이 녹화용 프레임 캡처(393×636): 편가르기 1판 · 탑 몇 조각 · 장난감방 1판 → out/<game>/*.png
 * 이어서 tools/make-gif.py 로 GIF 를 만듦. 입력은 모두 실제 터치(CDP)·탭.
 *   NODE_PATH=$(npm root -g) node tools/capture-play-gif.cjs http://127.0.0.1:4173/ shots/gif
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', out = 'shots/gif'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (card, c) => card[c.axis] === c.value;
function correctBin(card, rule) {
  const [a, b] = rule.conds; let base;
  switch (rule.kind) { case 'single': base = has(card, a) ? 0 : 1; break; case 'and': base = has(card, a) && has(card, b) ? 0 : 1; break; case 'or': base = has(card, a) || has(card, b) ? 0 : 1; break; case 'exclude': base = has(card, a) && !has(card, b) ? 0 : 1; break; case 'three': base = has(card, a) ? 0 : has(card, b) ? 2 : 1; break; }
  const bins = rule.kind === 'three' ? 3 : 2; return rule.reversed ? bins - 1 - base : base;
}
async function recorder(page, dir) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  let on = true, n = 0;
  const loop = (async () => { while (on) { const t = Date.now(); await page.screenshot({ path: `${dir}/${String(n++).padStart(4, '0')}.png` }).catch(() => {}); await sleep(Math.max(0, 140 - (Date.now() - t))); } })();
  return async () => { on = false; await loop; return n; };
}
async function tapSel(page, sel) { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
async function start(page, game) {
  await page.goto(url + `mini-game-land/?games=sort,tower,toyroom${game === 'toyroom' ? '&dev=1' : ''}`);
  await page.waitForSelector('[data-testid=home]');
  await tapSel(page, '[data-testid=go-free]'); await sleep(300); await tapSel(page, `[data-testid=pick-${game}]`); await sleep(300); await tapSel(page, '[data-testid=start]');
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  // 편가르기
  await start(page, 'sort');
  let stop = await recorder(page, `${out}/sort`);
  await page.waitForSelector('[data-testid=card]', { timeout: 8000 });
  for (let i = 0; i < 12 && !(await page.locator('[data-testid=result]').count()); i++) {
    const s = await page.evaluate(() => { const st = document.querySelector('[data-testid=stage]'); const c = document.querySelector('[data-testid=card]'); return st && c && st.dataset.locked !== '1' ? { rule: JSON.parse(st.dataset.rule), card: { color: c.dataset.color, face: c.dataset.face, feature: c.dataset.feature }, i: st.dataset.index } : null; });
    if (!s) { await sleep(60); i--; continue; }
    await sleep(380); // 사람처럼 잠깐 보고
    await tapSel(page, `[data-testid=bin-${correctBin(s.card, s.rule)}]`);
    await page.waitForFunction((i) => { const st = document.querySelector('[data-testid=stage]'); return !st || st.dataset.index !== i || document.querySelector('[data-testid=result]'); }, s.i, { timeout: 4000 }).catch(() => {});
  }
  await sleep(1800); console.log('sort frames', await stop());
  // 아슬아슬 탑
  await start(page, 'tower');
  stop = await recorder(page, `${out}/tower`);
  for (let k = 0; k < 6; k++) {
    await page.waitForFunction(() => document.querySelector('[data-testid=stage]')?.dataset.phase === 'aim', null, { timeout: 9000 }).catch(() => {});
    const s = await page.evaluate(() => { const e = document.querySelector('[data-testid=stage]'); if (!e || e.dataset.phase !== 'aim') return null; const d = e.dataset; return { aim: +d.aimX, sup: +d.supportX, k: +d.scale }; });
    if (!s) break; // 목표 높이에 닿아 결과 화면으로 넘어감
    const box = await page.locator('[data-testid=stage]').boundingBox();
    const x0 = box.x + box.width / 2, y0 = box.y + box.height * 0.75, dx = (s.sup - s.aim) * s.k + (k % 2 ? 6 : -6);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 8, y: y0 }] }); await sleep(30); }
    await sleep(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(600);
  }
  await sleep(1500); console.log('tower frames', await stop());
  // 장난감방
  await start(page, 'toyroom');
  await page.waitForSelector('[data-testid=board]');
  stop = await recorder(page, `${out}/toyroom`);
  const sol = await page.evaluate(() => JSON.parse(document.querySelector('[data-testid=board]').dataset.solution || '[]'));
  for (const [from, idx, to] of sol) {
    await page.waitForFunction(() => document.querySelector('[data-testid=board]')?.dataset.busy !== '1', null, { timeout: 6000 }).catch(() => {});
    await sleep(350);
    const sb = await page.locator(`[data-testid=board] [data-shelf="${from}"] [data-slot="${idx}"]`).first().boundingBox();
    await page.touchscreen.tap(sb.x + sb.width / 2, sb.y + sb.height / 2);
    await sleep(300);
    const sh = await page.locator(`[data-testid=board] [data-shelf="${to}"]`).first().boundingBox();
    await page.touchscreen.tap(sh.x + sh.width / 2, sh.y + sh.height / 2);
  }
  await sleep(2500); console.log('toyroom frames', await stop());
  await b.close();
})();
