#!/usr/bin/env node
/** 줄넘기·가짜 찾기 실제 플레이 프레임(393×636, 실제 탭) → out/<game>/*.png → tools/make-gif.py */
const fs = require('fs');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/mini-game-land/', out = 'shots/gif'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  for (const id of ['jump', 'spot']) {
    const dir = `${out}/${id}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: 393, height: 636 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(`${url}?games=${id}${id === 'spot' ? '&dev=1' : ''}`); await p.waitForSelector('[data-testid=home]');
    await p.locator('[data-testid=go-free]').tap(); await p.locator(`[data-testid=pick-${id}]`).tap();
    let n = 0, on = true;
    const rec = (async () => { while (on) { const t = Date.now(); await p.screenshot({ path: `${dir}/${String(n++).padStart(4, '0')}.png` }).catch(() => {}); await sleep(Math.max(0, 110 - (Date.now() - t))); } })();
    await p.locator('[data-testid=start]').tap();
    await p.waitForFunction(() => document.querySelector('[data-testid=round]')?.dataset.phase === 'playing');
    const t0 = Date.now(); let lastKey = '';
    while (Date.now() - t0 < 16000 && !(await p.locator('[data-testid=result]').count())) {
      if (id === 'jump') {
        const d = await p.evaluate(() => { const e = document.querySelector('[data-testid=jump-stage]'); return e ? { np: +e.dataset.nextPass, air: e.dataset.air === '1', key: `${+e.dataset.ok + +e.dataset.miss}` } : null; });
        if (d && !d.air && d.key !== lastKey && d.np <= 185 + (Math.random() * 2 - 1) * 60) { const bx = await p.locator('[data-testid=jump-stage]').boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height * 0.6); lastKey = d.key; }
        await sleep(8);
      } else {
        const a = await p.evaluate(() => +document.querySelector('[data-testid=spot-board]')?.dataset.answer);
        await sleep(900);
        if (await p.locator('[data-testid=result]').count()) break;
        const c = p.locator(`[data-testid=spot-cell-${a}]`);
        if (await c.count()) { const bb = await c.boundingBox(); if (bb) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
      }
    }
    await sleep(900); on = false; await rec; console.log(id, 'frames', n);
    await ctx.close();
  }
  await b.close();
})();
