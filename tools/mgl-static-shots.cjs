#!/usr/bin/env node
/**
 * 정적 화면(홈·목록·안내·챌린지 안내·기록)을 두 크기로 캡처 — 리팩터링 전/후 픽셀 비교용.
 *   NODE_PATH=$(npm root -g) node tools/mgl-static-shots.cjs <url> <out-dir>
 */
const fs = require('fs');
const { chromium } = require('playwright');
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'networkidle' });
    const shot = (n) => p.screenshot({ path: `${out}/${w}x${h}-${n}.png` });
    await p.locator('[data-testid=home]').waitFor();
    await shot('home');
    await p.locator('[data-testid=go-records]').tap(); await p.locator('[data-testid=records]').waitFor(); await shot('records');
    await p.getByText('돌아가기').first().tap();
    await p.locator('[data-testid=go-free]').tap(); await p.locator('[data-testid=free-select]').waitFor(); await shot('free-select');
    await p.locator('[data-testid=pick-sort]').tap(); await p.locator('[data-testid=free-prepare]').waitFor(); await shot('free-prepare');
    await p.getByText('뒤로').first().tap(); await p.getByText('돌아가기').first().tap();
    await p.locator('[data-testid=go-challenge]').tap(); await p.locator('[data-testid=challenge-start]').waitFor(); await shot('challenge-start');
    await ctx.close();
  }
  await b.close();
})();
