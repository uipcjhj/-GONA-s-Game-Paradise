#!/usr/bin/env node
/** 간식 받아라 실제 플레이 프레임(393×636, 손가락 드래그) → out/*.png, 이어서 tools/make-gif.py */
const fs = require('fs');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', out = 'shots/gif/catch', level = '3'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto(url + 'mini-game-land/?games=catch'); await p.waitForSelector('[data-testid=home]');
  await p.locator('[data-testid=go-free]').tap(); await p.locator('[data-testid=pick-catch]').tap();
  for (let i = 0; i < 20 && !(await p.locator('[data-testid=start-level]').innerText()).includes(`LV ${level}`); i++) { await p.locator('[aria-label="레벨 올리기"]').tap(); await sleep(60); }
  let n = 0, on = true;
  const rec = (async () => { while (on) { const t = Date.now(); await p.screenshot({ path: `${out}/${String(n++).padStart(4, '0')}.png` }).catch(() => {}); await sleep(Math.max(0, 120 - (Date.now() - t))); } })();
  await p.locator('[data-testid=start]').tap();
  await p.waitForSelector('[data-testid=catch-stage]');
  await p.waitForFunction(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing');
  const box = await p.locator('[data-testid=catch-stage]').boundingBox();
  const st = () => p.evaluate(() => { const d = document.querySelector('[data-testid=catch-stage]')?.dataset; return d ? { x: +d.basketX, t: +d.targetX, k: +d.scale, off: +d.offset } : null; });
  let s = await st(); const y = box.y + box.height * 0.85; let fx = box.x + s.off + s.x * s.k;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fx, y }] });
  const t0 = Date.now();
  while (Date.now() - t0 < 14000 && !(await p.locator('[data-testid=result]').count())) {
    s = await st(); if (!s) break;
    fx += Math.max(-12, Math.min(12, box.x + s.off + s.t * s.k - fx));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fx, y }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(600); on = false; await rec; console.log('frames', n);
  await b.close();
})();
