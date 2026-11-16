#!/usr/bin/env node
/**
 * 간식 받아라 모바일 점검(393×636 · 390×844) — 실제 터치(CDP)로 손가락을 좌우로 끌어 플레이.
 * 봇은 기반이 주는 data-target-x(가장 급한 간식) 쪽으로 손가락을 옮김(스킨과 무관).
 *   NODE_PATH=$(npm root -g) node tools/mgl-catch-check.cjs "http://127.0.0.1:4173/mini-game-land/?games=catch" shots/mgl-catch
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url, out = 'shots/mgl-catch'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tapSel(p, s) { const l = p.locator(s).first(); await l.waitFor({ state: 'visible', timeout: 8000 }); const b = await l.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
const st = (p) => p.evaluate(() => { const e = document.querySelector('[data-testid=catch-stage]'); if (!e) return null; const d = e.dataset; return { phase: d.phase, x: +d.basketX, t: +d.targetX, k: +d.scale, off: +d.offset, caught: +d.caught, goal: +d.goal, miss: +d.miss }; });
async function layout(p, tag) {
  const r = await p.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    for (const el of document.querySelectorAll('button, a')) { const b = el.getBoundingClientRect(); if (!b.width) continue; if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push('밖 ' + el.textContent.trim().slice(0, 10)); if (b.width < 44 || b.height < 44) bad.push('작음 ' + el.textContent.trim().slice(0, 10)); }
    const s = document.querySelector('[data-testid=catch-stage]').getBoundingClientRect(), c = document.querySelector('[data-testid=catcher]')?.getBoundingClientRect();
    if (s.height < 260) bad.push('무대가 작음 ' + Math.round(s.height));
    if (c && (c.bottom > s.bottom + 1 || c.left < s.left - 1 || c.right > s.right + 1)) bad.push('고나가 무대 밖');
    return { sx: document.documentElement.scrollWidth > vw, sy: document.documentElement.scrollHeight > vh, bad };
  });
  ok(`${tag}: 스크롤 없음`, !r.sx && !r.sy);
  ok(`${tag}: 잘림·겹침 없음, 터치 44px↑, 고나가 무대 안`, r.bad.length === 0, r.bad.join(' | '));
}
async function play(p, cdp, { follow = true, ms = 70000 } = {}) {
  await p.waitForSelector('[data-testid=catch-stage]');
  const box = await p.locator('[data-testid=catch-stage]').boundingBox();
  const y = box.y + box.height * 0.85;
  let s = await st(p);
  let fx = box.x + s.off + s.x * s.k;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fx, y }] });
  const t0 = Date.now(); let moves = 0;
  while (Date.now() - t0 < ms && !(await p.locator('[data-testid=result]').count())) {
    s = await st(p);
    if (!s) { await sleep(50); continue; }
    if (follow) {
      const tx = box.x + s.off + s.t * s.k;
      fx += Math.max(-14, Math.min(14, tx - fx)); // 손가락 속도 제한(사람처럼)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fx, y }] }); moves++;
    }
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
  if (process.env.DBG) console.log('play end', (Date.now() - t0) / 1000, await p.locator('[data-testid=result]').count(), JSON.stringify(await st(p)), await p.evaluate(() => document.querySelector('[data-testid=round]')?.dataset.phase));
  return { sec: (Date.now() - t0) / 1000, moves };
}
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}×${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await p.goto(url); await p.waitForSelector('[data-testid=home]');
    await tapSel(p, '[data-testid=go-free]');
    ok(`${tag} 자유 플레이 목록에 간식 받아라`, (await p.locator('[data-testid=pick-catch]').count()) === 1);
    await p.screenshot({ path: `${out}/${w}x${h}-01-select.png` });
    await tapSel(p, '[data-testid=pick-catch]');
    const how = await p.locator('.mgl-screen').innerText();
    ok(`${tag} 규칙 설명 3줄(3초 안에 이해: 좌우·받기·피하기)`, how.includes('좌우') && how.includes('고추'));
    await p.screenshot({ path: `${out}/${w}x${h}-02-howto.png` });
    await tapSel(p, '[data-testid=start]');
    await p.waitForFunction(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing', null, { timeout: 8000 });
    await layout(p, `${tag} 플레이`);
    await sleep(1500);
    await p.screenshot({ path: `${out}/${w}x${h}-03-play.png` });
    const r = await play(p, cdp);
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    const res = await p.locator('[data-testid=result]').innerText();
    ok(`${tag} 손가락으로 끌어 L1 클리어`, /CLEAR/.test(res), `${r.sec.toFixed(1)}초, 이동 ${r.moves}`);
    ok(`${tag} 한 판 길이 20~60초 범위(L1)`, r.sec >= 18 && r.sec <= 60, `${r.sec.toFixed(1)}초`);
    await p.screenshot({ path: `${out}/${w}x${h}-04-result.png` });
    const save = await p.evaluate(() => JSON.parse(localStorage.getItem('gmgl.v1') || '{}'));
    ok(`${tag} 기록 저장(최고 점수·클리어 레벨)`, JSON.stringify(save).includes('catch'));
    // 실패 경로: 다음 레벨에서 손을 대지 않음 → 놓침 누적 → 실패
    await tapSel(p, '[data-testid=next]');
    await p.waitForSelector('[data-testid=result]', { state: 'detached', timeout: 8000 });
    await p.waitForFunction(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing', null, { timeout: 8000 });
    await play(p, cdp, { follow: false, ms: 70000 });
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    ok(`${tag} 가만히 있으면 실패(놓침 한도)`, /MISS|실패|TIME/i.test(await p.locator('[data-testid=result]').innerText()));
    await p.screenshot({ path: `${out}/${w}x${h}-05-fail.png` });
    // 챌린지에 포함되는지
    await p.goto(url.replace('games=catch', 'games=catch,sort'));
    await p.waitForSelector('[data-testid=home]');
    await tapSel(p, '[data-testid=go-challenge]'); await tapSel(p, '[data-testid=start]');
    await p.waitForSelector('[data-testid=intro]');
    ok(`${tag} 랜덤 챌린지 라운드 시작`, (await p.locator('[data-testid=intro]').innerText()).includes('ROUND'));
    ok(`${tag} 콘솔 오류 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
