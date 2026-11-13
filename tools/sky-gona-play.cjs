/* 고나 신규 스프라이트 실제 플레이 테스트 — iPhone 크기 에뮬레이션(Chromium) + CDP 터치(멀티터치)
 * 사용: NODE_PATH=$(npm root -g) node tools/sky-gona-play.cjs http://localhost:4173/ out-dir */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'shots-gona';
fs.mkdirSync(out, { recursive: true });
const PROFILES = [
  { tag: 'iphone13-390x844', ctx: { ...devices['iPhone 13'] } },
  { tag: 'inapp-393x636', ctx: { viewport: { width: 393, height: 636 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent } },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const log = [];
  for (const P of PROFILES) {
    const errors = [];
    const ctx = await browser.newContext(P.ctx);
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id })) });
    await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
    await page.waitForSelector('.sel-art');
    await page.tap('.sky-btn-go');
    await page.waitForSelector('.sky-canvas');
    const box = await (await page.$('.sky-canvas')).boundingBox();
    const L = (x, y) => ({ x: box.x + (x / 180) * box.width, y: box.y + (y / 320) * box.height });
    const dbg = () => page.evaluate(() => window.__sky.debug());
    const shot = async (name) => {
      const d = await dbg();
      const p = L(d.px, d.py);
      await page.screenshot({ path: `${out}/${P.tag}-${name}.png` });
      const k = box.width / 180;
      await page.screenshot({ path: `${out}/${P.tag}-${name}-zoom.png`, clip: { x: Math.max(0, p.x - 50 * k), y: Math.max(0, p.y - 50 * k), width: 100 * k, height: 90 * k } });
      log.push(`${P.tag} ${name}: anim=${d.anim} scale=${d.spriteScale} S=${d.S} px=${d.px},${d.py} hp=${d.hp}`);
    };
    await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('power'); window.__sky.cheat('bombs'); });
    // 손가락 0: 드래그 시작
    let f = L(90, 250);
    await touch('touchStart', [{ ...f, id: 0 }]);
    await sleep(2600);
    await shot('01-fly');
    // 빠르게 왼쪽 (강한 기울기)
    for (let i = 0; i < 6; i++) { f = { x: f.x - 9, y: f.y }; await touch('touchMove', [{ ...f, id: 0 }]); await sleep(16); }
    await shot('02-bankL-strong');
    for (let i = 0; i < 10; i++) { f = { x: f.x - 2, y: f.y }; await touch('touchMove', [{ ...f, id: 0 }]); await sleep(30); }
    await shot('03-bankL-weak');
    await sleep(500);
    for (let i = 0; i < 8; i++) { f = { x: f.x + 9, y: f.y }; await touch('touchMove', [{ ...f, id: 0 }]); await sleep(16); }
    await shot('04-bankR-strong');
    await sleep(600);
    // 멀티터치: 이동하면서 차지 버튼 누름
    const cb = await (await page.$('.sky-charge')).boundingBox();
    const c = { x: cb.x + cb.width / 2, y: cb.y + cb.height / 2 };
    await touch('touchStart', [{ ...f, id: 0 }, { ...c, id: 1 }]);
    for (let i = 0; i < 12; i++) { f = { x: f.x + (i % 2 ? 3 : -3), y: f.y - 1 }; await touch('touchMove', [{ ...f, id: 0 }, { ...c, id: 1 }]); await sleep(40); }
    await shot('05-charge-mid');
    await sleep(700);
    await shot('06-charge-full');
    await touch('touchEnd', [{ ...c, id: 1 }]);   // 차지 버튼(손가락 1)만 뗌 — 손가락 0은 계속 누름
    await sleep(70);
    await shot('07-shoot-release');
    await sleep(500);
    const bb = await (await page.$('.sky-bomb')).boundingBox();
    await touch('touchStart', [{ ...f, id: 0 }, { x: bb.x + 20, y: bb.y + 20, id: 2 }]);
    await touch('touchEnd', [{ x: bb.x + 20, y: bb.y + 20, id: 2 }]);
    await sleep(450);
    await shot('08-bomb');
    await sleep(1800);
    await page.evaluate(() => window.__sky.cheat('hurt'));
    await sleep(90);
    await shot('09-hurt');
    await sleep(900);
    // 보스전 + 탄막 가독성
    await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('boss'); });
    for (let i = 0; i < 90; i++) { f = { x: L(90 + 50 * Math.sin(i / 9), 250).x, y: f.y }; await touch('touchMove', [{ ...f, id: 0 }]); await sleep(90); }
    await shot('10-boss-bullets');
    // 차지 오라 + 탄막
    await touch('touchStart', [{ ...f, id: 0 }, { ...c, id: 1 }]);
    await sleep(1150);
    await shot('11-boss-charge-aura');
    await touch('touchEnd', [{ ...c, id: 1 }]);
    await sleep(60);
    await shot('11b-boss-chargeshot');
    // 대기: 손 뗌
    await touch('touchEnd', []);
    await sleep(1900);
    await shot('12-idle');
    // FPS
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const step = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(step); else res(Math.round(n / 2)); }; requestAnimationFrame(step); }));
    log.push(`${P.tag} fps(헤드리스 추정)=${fps}`);
    // 승리
    await page.evaluate(() => window.__sky.cheat('killboss'));
    await touch('touchStart', [{ ...f, id: 0 }]);
    for (let i = 0; i < 40; i++) { const d = await dbg(); if (d.over) break; await sleep(100); }
    await touch('touchEnd', []);
    await sleep(500);
    await shot('13-win');
    // 격파: 새 판
    await page.goto(`${base}?skytest&r=${Math.random()}#sky`);
    await page.waitForSelector('.sel-art'); await page.tap('.sky-btn-go'); await page.waitForSelector('.sky-canvas');
    await sleep(1500);
    await page.evaluate(() => { window.__sky.cheat('hp1'); window.__sky.cheat('hurt'); });
    await sleep(450);
    await shot('14-defeat');
    log.push(`${P.tag} console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  }
  console.log(log.join('\n'));
  await browser.close();
})();
