#!/usr/bin/env node
/**
 * 신규 게임 점검(393×636 · 390×844): jump(줄넘기) · spot(가짜 친구 찾기) — 실제 탭 입력.
 *  jump: 기반의 data-next-pass(다음 줄 통과까지 ms)를 보고 사람처럼 약간 흔들리게 탭
 *  spot: ?dev=1 의 data-answer(정답 칸)를 실제 탭, 일부러 오답도 눌러 봄
 *   NODE_PATH=$(npm root -g) node tools/mgl-new-check.cjs http://127.0.0.1:4173/mini-game-land/ shots/mgl-new
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [base, out = 'shots/mgl-new'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tapSel(p, s) { const l = p.locator(s).first(); await l.waitFor({ state: 'visible', timeout: 8000 }); const b = await l.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
async function layout(p, tag, stageSel) {
  const r = await p.evaluate((sel) => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    for (const el of document.querySelectorAll('button, a')) { const b = el.getBoundingClientRect(); if (!b.width) continue; if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push('밖 ' + (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 8))); if (b.width < 44 || b.height < 44) bad.push(`작음 ${el.getAttribute('aria-label') || el.textContent.trim().slice(0, 8)} ${Math.round(b.width)}x${Math.round(b.height)}`); }
    const s = document.querySelector(sel).getBoundingClientRect(); if (s.height < 240) bad.push('무대 작음 ' + Math.round(s.height));
    return { sx: document.documentElement.scrollWidth > vw, sy: document.documentElement.scrollHeight > vh, bad };
  }, stageSel);
  ok(`${tag}: 스크롤 없음`, !r.sx && !r.sy);
  ok(`${tag}: 잘림·겹침 없음, 터치 44px↑`, r.bad.length === 0, r.bad.slice(0, 4).join(' | '));
}
const playing = (p) => p.waitForFunction(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing', null, { timeout: 8000 });
async function startFree(p, id, url) {
  await p.goto(url); await p.waitForSelector('[data-testid=home]');
  await tapSel(p, '[data-testid=go-free]'); await tapSel(p, `[data-testid=pick-${id}]`);
  const how = await p.locator('.mgl-screen').innerText();
  await tapSel(p, '[data-testid=start]'); await playing(p);
  return how;
}
async function playJump(p, { jitter = 60, skip = false, ms = 70000 } = {}) {
  const box = await p.locator('[data-testid=jump-stage]').boundingBox();
  const t0 = Date.now(); let taps = 0, lastKey = '';
  while (Date.now() - t0 < ms && !(await p.locator('[data-testid=result]').count())) {
    const d = await p.evaluate(() => { const e = document.querySelector('[data-testid=jump-stage]'); return e ? { np: +e.dataset.nextPass, air: e.dataset.air === '1', key: `${+e.dataset.ok + +e.dataset.miss}` } : null; });
    if (!d) { await sleep(20); continue; }
    // 이상적인 탭: 통과 220ms 전(공중 440ms 의 절반) — 사람처럼 ±jitter
    const want = 220 - 35 + (Math.random() * 2 - 1) * jitter;
    if (!skip && !d.air && d.key !== lastKey && d.np <= want) { await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.6); taps++; lastKey = d.key; }
    await sleep(8);
  }
  return { sec: (Date.now() - t0) / 1000, taps };
}
async function playSpot(p, { wrong = 0, ms = 70000 } = {}) {
  const t0 = Date.now(); let taps = 0, w = wrong;
  while (Date.now() - t0 < ms && !(await p.locator('[data-testid=result]').count())) {
    const a = await p.evaluate(() => { const g = document.querySelector('[data-testid=spot-board]'); return g ? { ans: +g.dataset.answer, n: g.children.length } : null; });
    if (!a) { await sleep(30); continue; }
    await sleep(450); // 사람이 훑어보는 시간(대략)
    if (await p.locator('[data-testid=result]').count()) break;
    if (await p.evaluate(() => document.querySelector('[data-testid=round]')?.dataset.phase !== 'playing')) { await sleep(100); continue; }
    const idx = w > 0 ? (a.ans + 1) % Math.max(2, a.n - 1) : a.ans;
    if (w > 0) w--;
    await tapSel(p, `[data-testid=spot-cell-${idx}]`); taps++;
  }
  return { sec: (Date.now() - t0) / 1000, taps };
}
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}×${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    p.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.url()}`));
    // ── 줄넘기
    let how = await startFree(p, 'jump', `${base}?games=jump`);
    ok(`${tag} 줄넘기: 3줄 규칙(탭·발밑·박자)`, how.includes('탭') && how.includes('발밑'));
    await layout(p, `${tag} 줄넘기`, '[data-testid=jump-stage]');
    await sleep(900); await p.screenshot({ path: `${out}/${w}x${h}-jump-play.png` });
    let r = await playJump(p);
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    let res = await p.locator('[data-testid=result]').innerText();
    ok(`${tag} 줄넘기: 탭으로 L1 클리어`, /CLEAR/.test(res), `${r.sec.toFixed(1)}초, 탭 ${r.taps}`);
    ok(`${tag} 줄넘기: 한 판 20~60초`, r.sec >= 15 && r.sec <= 60, `${r.sec.toFixed(1)}초`);
    await p.screenshot({ path: `${out}/${w}x${h}-jump-result.png` });
    await tapSel(p, '[data-testid=next]'); await p.waitForSelector('[data-testid=result]', { state: 'detached' }); await playing(p);
    r = await playJump(p, { skip: true });
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    ok(`${tag} 줄넘기: 안 뛰면 걸려서 실패`, !/CLEAR/.test(await p.locator('[data-testid=result]').innerText()), `${r.sec.toFixed(1)}초`);
    // ── 가짜 친구 찾기
    how = await startFree(p, 'spot', `${base}?games=spot&dev=1`);
    ok(`${tag} 가짜 찾기: 3줄 규칙(한 명만 다름)`, how.includes('한 명만'));
    await layout(p, `${tag} 가짜 찾기`, '[data-testid=spot-board]');
    await p.screenshot({ path: `${out}/${w}x${h}-spot-play.png` });
    const before = await p.evaluate(() => +document.querySelector('[data-testid=spot-board]').dataset.miss);
    r = await playSpot(p, { wrong: 1 });
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    res = await p.locator('[data-testid=result]').innerText();
    ok(`${tag} 가짜 찾기: 오답 1번 후에도 L1 클리어`, /CLEAR/.test(res) && before === 0, `${r.sec.toFixed(1)}초, 탭 ${r.taps}`);
    await p.screenshot({ path: `${out}/${w}x${h}-spot-result.png` });
    await tapSel(p, '[data-testid=next]'); await p.waitForSelector('[data-testid=result]', { state: 'detached' }); await playing(p);
    await p.screenshot({ path: `${out}/${w}x${h}-spot-L2.png` });
    r = await playSpot(p, { wrong: 9 });
    await p.waitForSelector('[data-testid=result]', { timeout: 8000 });
    ok(`${tag} 가짜 찾기: 오답 3번이면 실패`, !/CLEAR/.test(await p.locator('[data-testid=result]').innerText()));
    // ── 챌린지·기록
    await p.goto(`${base}?games=jump,spot`); await p.waitForSelector('[data-testid=home]');
    await tapSel(p, '[data-testid=go-records]');
    const rec = await p.locator('.mgl-screen').innerText();
    ok(`${tag} 내 기록에 두 게임`, rec.includes('줄넘기') && rec.includes('가짜'));
    await tapSel(p, '[data-testid=back]').catch(async () => { await p.getByText('돌아가기').first().tap(); });
    await p.waitForSelector('[data-testid=home]');
    await tapSel(p, '[data-testid=go-challenge]'); await tapSel(p, '[data-testid=start]');
    await p.waitForSelector('[data-testid=intro]');
    ok(`${tag} 랜덤 챌린지 라운드에 등장`, /줄넘기|가짜/.test(await p.locator('[data-testid=intro]').innerText()));
    ok(`${tag} 콘솔 오류·리소스 실패 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
