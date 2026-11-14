#!/usr/bin/env node
/**
 * 소리 점검(393×636 · 390×844): 오실레이터 시작 수를 세어 BGM 중복·잔류·음소거를 확인(헤드리스라 실제로 들리지는 않음).
 *   NODE_PATH=$(npm root -g) node tools/sound-check.cjs http://127.0.0.1:4173/
 */
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/'] = process.argv.slice(2);
let pass = 0, fail = 0;
const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INIT = () => {
  window.__osc = 0;
  const s = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...a) { window.__osc++; return s.apply(this, a); };
  try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {}
};
async function rate(page, ms = 3000) { const a = await page.evaluate(() => window.__osc); await sleep(ms); return ((await page.evaluate(() => window.__osc)) - a) / (ms / 1000); }
const hide = (page, h) => page.evaluate((h) => { Object.defineProperty(document, 'hidden', { value: h, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, h);

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(url);
    await page.waitForSelector('.title');
    const r0 = await rate(page, 1500);
    ok(`[${tag}] 첫 터치 전에는 BGM 없음`, r0 < 0.5, `${r0}/s`);
    await page.touchscreen.tap(w / 2, h / 2);
    await page.fill('#gp-nick', '소리검사'); await page.getByRole('button', { name: /다음/ }).tap(); await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.waitForSelector('text=WELCOME!'); await page.getByRole('button', { name: /시작|입장|출발|월드/ }).first().tap().catch(() => {}); await page.waitForSelector('.hit');
    await page.touchscreen.tap(20, h / 2);
    const r1 = await rate(page);
    ok(`[${tag}] 월드맵: 홈 BGM 재생`, r1 > 2, `${r1.toFixed(1)}/s`);
    for (let i = 0; i < 6; i++) for (const t of ['profile', 'ranking', 'more', 'map']) await page.locator(`[data-testid=nav-${t}]`).tap();
    await sleep(400);
    const r2 = await rate(page);
    ok(`[${tag}] 탭을 24번 오가도 BGM 하나(중복 없음)`, r2 > 2 && r2 < r1 * 1.4, `${r1.toFixed(1)} → ${r2.toFixed(1)}/s`);
    await hide(page, true); await sleep(300);
    const r3 = await rate(page, 2000);
    ok(`[${tag}] 탭이 숨겨지면 멈춤(잔류 재생 없음)`, r3 < 0.5, `${r3}/s`);
    await hide(page, false); await sleep(300);
    const r4 = await rate(page);
    ok(`[${tag}] 다시 보이면 하나만 이어서 재생`, r4 > 2 && r4 < r1 * 1.4, `${r4.toFixed(1)}/s`);
    await page.locator('[data-testid=nav-more]').tap(); await page.getByRole('button', { name: /설정/ }).tap();
    await page.locator('[data-testid=set-bgm]').tap(); await sleep(400);
    const r5 = await rate(page, 2000);
    ok(`[${tag}] BGM 끄기 → 즉시 정지`, r5 < 0.5, `${r5}/s`);
    await page.locator('[data-testid=set-bgm]').tap(); await sleep(400);
    await page.getByRole('switch', { name: '효과음' }).tap(); await sleep(400);
    const r6 = await rate(page, 2000);
    ok(`[${tag}] 효과음 끄기(음소거) → BGM 도 정지`, r6 < 0.5, `${r6}/s`);
    await page.getByRole('switch', { name: '효과음' }).tap(); await sleep(400);
    ok(`[${tag}] 음소거 해제 → 다시 재생`, (await rate(page, 2000)) > 2);
    // Mini Game Land: 메뉴곡 → 게임곡 → 메뉴곡
    const mini = await ctx.newPage();
    await mini.goto(url + 'mini-game-land/?games=sort');
    await mini.waitForSelector('[data-testid=home]');
    await mini.locator('[data-testid=go-free]').tap();
    const m1 = await rate(mini);
    ok(`[${tag}] Mini Game Land 메뉴 BGM`, m1 > 2, `${m1.toFixed(1)}/s`);
    await mini.locator('[data-testid=pick-sort]').tap(); await mini.locator('[data-testid=start]').tap();
    await mini.waitForSelector('[data-testid=card]', { timeout: 8000 });
    const m2 = await rate(mini);
    ok(`[${tag}] 게임 중에는 게임 곡 하나(메뉴 곡과 겹치지 않음)`, m2 > 2 && m2 < m1 * 1.6, `${m2.toFixed(1)}/s`);
    await mini.locator('[data-testid=pause]').tap(); await mini.locator('[data-testid=quit]').tap(); await mini.locator('[data-testid=quit]').tap();
    await mini.waitForSelector('[data-testid=free-select]');
    await mini.getByText('돌아가기').first().tap(); await mini.waitForSelector('[data-testid=home]');
    await mini.locator('[data-testid=sound]').tap(); await sleep(300);
    const m3 = await rate(mini, 2000);
    ok(`[${tag}] Mini 소리 끄기 → BGM 정지`, m3 < 0.5, `${m3}/s`);
    ok(`[${tag}] 페이지 오류 없음`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
