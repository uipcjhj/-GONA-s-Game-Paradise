#!/usr/bin/env node
/**
 * 게임 템포 지표(실제 터치 봇, 393×636). "재미"가 아니라 객관적 템포만 잰다 — 재미는 사람 플레이 테스트가 필요.
 *  - 시작 대기: 시작 버튼 탭 → 첫 입력 가능
 *  - 한 판 길이 · 입력 수 · 초당 입력 · 막힌 시간 비율(입력하려 해도 잠금/정착/연출로 기다린 시간)
 *  - 결과 대기: 마지막 입력 → 결과 화면
 *   NODE_PATH=$(npm root -g) node tools/fun-metrics.cjs http://127.0.0.1:4173/ [levels=1,5] > metrics.json
 */
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', lv = '1,5', only = ''] = process.argv.slice(2);
const LEVELS = lv.split(',').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (c, x) => c[x.axis] === x.value;
function bin(card, r) { const [a, b] = r.conds; let k; switch (r.kind) { case 'single': k = has(card, a) ? 0 : 1; break; case 'and': k = has(card, a) && has(card, b) ? 0 : 1; break; case 'or': k = has(card, a) || has(card, b) ? 0 : 1; break; case 'exclude': k = has(card, a) && !has(card, b) ? 0 : 1; break; case 'three': k = has(card, a) ? 0 : has(card, b) ? 2 : 1; } const n = r.kind === 'three' ? 3 : 2; return r.reversed ? n - 1 - k : k; }
async function tapSel(p, s) { const b = await p.locator(s).first().boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
const resultOn = (p) => p.locator('[data-testid=result]').count();
const playing = (p) => p.evaluate(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing');

/** 게임별: ready(p) = 지금 입력 가능한가, act(p) = 입력 1회(동기 대기 없이) */
const GAMES = {
  sort: {
    ready: (p) => p.evaluate(() => { const s = document.querySelector('[data-testid=stage]'); return !!(s && s.dataset.locked !== '1' && document.querySelector('[data-testid=card]')); }),
    act: async (p) => { const s = await p.evaluate(() => { const st = document.querySelector('[data-testid=stage]'), c = document.querySelector('[data-testid=card]'); return { r: JSON.parse(st.dataset.rule), c: { color: c.dataset.color, face: c.dataset.face, feature: c.dataset.feature }, i: st.dataset.index }; }); await tapSel(p, `[data-testid=bin-${bin(s.c, s.r)}]`); await p.waitForFunction((i) => { const st = document.querySelector('[data-testid=stage]'); return !st || st.dataset.index !== i || document.querySelector('[data-testid=result]'); }, s.i, { timeout: 4000 }).catch(() => {}); },
  },
  tower: {
    ready: (p) => p.evaluate(() => document.querySelector('[data-testid=stage]')?.dataset.phase === 'aim'),
    act: async (p, cdp) => { const s = await p.evaluate(() => { const d = document.querySelector('[data-testid=stage]').dataset; return { aim: +d.aimX, sup: +d.supportX, k: +d.scale }; }); const b = await p.locator('[data-testid=stage]').boundingBox(); const x0 = b.x + b.width / 2, y0 = b.y + b.height * 0.75, dx = (s.sup - s.aim) * s.k; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= 4; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 4, y: y0 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForFunction(() => document.querySelector('[data-testid=stage]')?.dataset.phase !== 'aim' || document.querySelector('[data-testid=result]'), null, { timeout: 3000 }).catch(() => {}); },
  },
  toyroom: {
    dev: true,
    ready: (p) => p.evaluate(() => { const b = document.querySelector('[data-testid=board]'); return !!(b && b.dataset.busy !== '1'); }),
    act: async (p) => { const st = await p.evaluate(() => { const b = document.querySelector('[data-testid=board]'); return { sol: JSON.parse(b.dataset.solution || '[]'), moves: +b.dataset.moves }; }); const m = st.sol[st.moves]; if (!m) return false; await tapSel(p, `[data-testid=board] [data-shelf="${m[0]}"] [data-slot="${m[1]}"]`); await tapSel(p, `[data-testid=board] [data-shelf="${m[2]}"]`); await p.waitForFunction((n) => { const b = document.querySelector('[data-testid=board]'); return !b || +b.dataset.moves > n || document.querySelector('[data-testid=result]'); }, st.moves, { timeout: 3000 }).catch(() => {}); },
  },
  catch: {
    ready: (p) => p.evaluate(() => { const s = document.querySelector('[data-testid=catch-stage]'); return !!s && s.dataset.phase === 'play'; }),
    act: async (p, cdp) => { const s = await p.evaluate(() => { const d = document.querySelector('[data-testid=catch-stage]').dataset; return { x: +d.basketX, t: +d.targetX, k: +d.scale }; }); const b = await p.locator('[data-testid=catch-stage]').boundingBox(); const x0 = b.x + s.x * s.k, y0 = b.y + b.height * 0.8, dx = (s.t - s.x) * s.k; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] }); for (let i = 1; i <= 3; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 3, y: y0 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(120); },
  },
};

(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [id, g] of Object.entries(GAMES)) {
    if (only && !only.split(',').includes(id)) continue;
    for (const level of LEVELS) {
      const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, hasTouch: true, isMobile: true });
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
      await p.goto(`${url}mini-game-land/?games=${id}${g.dev ? '&dev=1' : ''}`);
      if (!(await p.locator('[data-testid=home]').count())) await p.waitForSelector('[data-testid=home]', { timeout: 10000 });
      await tapSel(p, '[data-testid=go-free]'); await tapSel(p, `[data-testid=pick-${id}]`).catch(() => {});
      if (!(await p.locator('[data-testid=start]').count())) { console.error('no game', id); await ctx.close(); continue; }
      for (let i = 0; i < 30 && !(await p.locator('[data-testid=start-level]').innerText()).includes(`LV ${level}`); i++) { await tapSel(p, '[aria-label="레벨 올리기"]'); await sleep(60); }
      const t0 = Date.now();
      await tapSel(p, '[data-testid=start]');
      while (!((await playing(p)) && (await g.ready(p)))) await sleep(15);
      const tFirst = Date.now();
      let inputs = 0, blocked = 0, tLast = tFirst;
      while (!(await resultOn(p)) && Date.now() - tFirst < 120000) {
        const w0 = Date.now();
        while (!((await playing(p)) && (await g.ready(p))) && !(await resultOn(p))) await sleep(15);
        if (await resultOn(p)) break;
        if (inputs > 0) blocked += Date.now() - w0;
        if ((await g.act(p, cdp)) === false) break;
        inputs++; tLast = Date.now(); if (process.env.DBG) console.error("act", inputs, tLast - tFirst);
      }
      await p.waitForSelector('[data-testid=result]', { timeout: 15000 }).catch(() => {});
      const tEnd = Date.now();
      const dur = (tLast - tFirst) / 1000;
      out[`${id}-L${level}`] = { startWaitMs: tFirst - t0, inputs, lockPerInputMs: Math.round(blocked / Math.max(1, inputs - 1)), botRoundSec: +dur.toFixed(1), resultWaitMs: tEnd - tLast };
      console.error(id, level, JSON.stringify(out[`${id}-L${level}`]));
      await ctx.close();
    }
  }
  await b.close();
  console.log(JSON.stringify(out, null, 2));
})();
