#!/usr/bin/env node
/**
 * 실제 Mini Game Land(편가르기 등) ↔ 게임천국 결과 연동 브라우저 테스트
 *   운영 빌드 그대로, 게임천국 주소에 ?dev (개발판 게이팅) — 실제 미니게임 페이지(/mini-game-land/)를 같은 탭으로 열고,
 *   라운드를 끝까지(시간 초과) 진행한 뒤 '게임천국으로' 링크로 복귀 → 결과 화면·기록 확인.
 *   NODE_PATH=$(npm root -g) node tools/mini-e2e.cjs http://localhost:8092/-GONA-s-Game-Paradise/ out
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [base = 'http://localhost:8092/-GONA-s-Game-Paradise/', out = 'shots-mini'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const noH = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
const shot = async (page, n) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, `${n}.png`) }); };
async function drain(page) {
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator('.p-lvup, .p-ntoast').count())) { await page.waitForTimeout(200); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    // ① 운영 기본(주소에 ?dev 없음)에서는 Mini Game Land 가 COMING SOON
    await page.goto(base);
    await page.waitForSelector('.title');
    await page.touchscreen.tap(w / 2, h / 2);
    await page.fill('#gp-nick', '미니탐험');
    await page.getByRole('button', { name: /다음/ }).tap();
    await page.getByRole('radio', { name: '고나' }).tap();
    await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.getByRole('button', { name: /게임천국 입장/ }).tap();
    await page.waitForSelector('.hit');
    await drain(page);
    const idx = 3;
    let b = await page.locator('.hit').nth(idx).boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('.popup');
    ok(`[${tag}] 운영 기본: Mini Game Land COMING SOON · 입장 불가`, (await page.locator('.popup', { hasText: 'COMING SOON' }).count()) === 1 && (await page.locator('.popup .btn-go').count()) === 0);
    // ② 개발판(?dev): 입장 → 실제 미니게임 페이지
    await page.goto(base + '?dev');
    await page.waitForSelector('.title, .hit');
    if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2);
    await page.waitForSelector('.hit');
    b = await page.locator('.hit').nth(idx).boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('.popup .btn-go');
    await Promise.all([page.waitForURL(/mini-game-land/), page.locator('.popup .btn-go').tap()]);
    ok(`[${tag}] 개발판: 실제 Mini Game Land 가 같은 탭에서 ?gp=<세션> 으로 열림`, /[?&]gp=[\w-]{8,}/.test(page.url()));
    await page.waitForSelector('[data-testid=home]');
    ok(`[${tag}] 미니게임 홈 가로 스크롤 없음`, await noH(page));
    await shot(page, `mini-home_${tag}`);
    const backHref = await page.locator('[data-testid=back-hub]').getAttribute('href');
    ok(`[${tag}] '게임천국으로' 링크 = 세션의 돌아갈 주소(게임천국)`, /-GONA-s-Game-Paradise/.test(backHref || ''), backHref);
    // 자유 플레이 → 편가르기 → 라운드 끝까지(시간 초과)
    await page.locator('[data-testid=go-free]').tap();
    await page.locator('[data-testid=pick-sort]').tap();
    await page.locator('[data-testid=start], [data-testid=start-level]').first().tap();
    await page.waitForSelector('[data-testid=result]', { timeout: 150000 });
    await shot(page, `mini-result_${tag}`);
    ok(`[${tag}] 실제 미니게임 라운드 종료(결과 화면 표시)`, true);
    await page.waitForTimeout(600);
    const inbox = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.inbox.')).map((k) => JSON.parse(localStorage.getItem(k)).result));
    ok(`[${tag}] 결과 1건 전달(subGameId=sort · 게임 점수 · 플레이 시간)`, inbox.length === 1 && inbox[0].subGameId === 'sort' && inbox[0].gameId === 'minigame-paradise' && inbox[0].durationMs >= 1000, JSON.stringify(inbox[0] || {}).slice(0, 200));
    // 홈으로 → 게임천국으로 복귀
    await page.locator('[data-testid=menu], [data-testid=retry]').first().waitFor({ timeout: 5000 });
    await page.locator('[data-testid=menu]').first().tap().catch(() => {});
    await page.goto(page.url()); // 같은 세션 주소로 홈 복귀(링크 확인용)
    await page.waitForSelector('[data-testid=home]');
    await Promise.all([page.waitForURL(/-GONA-s-Game-Paradise/), page.locator('[data-testid=back-hub]').tap()]);
    await page.waitForSelector('text=RESULT', { timeout: 15000 });
    const rt = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] 게임천국 결과 화면(Mini Game Land · 점수 · 보상)`, rt.includes('Mini') && /XP|코인|짧은 판/.test(rt), rt.replace(/\n+/g, ' | ').slice(0, 140));
    await shot(page, `paradise-mini-result_${tag}`);
    ok(`[${tag}] 결과 화면 가로 스크롤 없음`, await noH(page));
    await drain(page);
    const p = await player(page);
    const rec = p.gameRecords['minigame-paradise'];
    ok(`[${tag}] 기록: 미니게임별(sort) 플레이 1회 · 업적(미니게임 입문)`, rec && rec.plays === 1 && rec.subGames?.sort?.plays === 1 && !!p.achievements.mini_first, JSON.stringify(rec && { plays: rec.plays, subs: Object.keys(rec.subGames || {}) }));
    ok(`[${tag}] 중복 없음(원장 1건) · inbox 정리`, p.resultLedger.length === 1 && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.inbox.')))));
    ok(`[${tag}] 단독 실행 회귀: ?gp 없는 미니게임은 기록 안 함`, await (async () => {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const p2 = await c2.newPage();
      await p2.goto(base.replace('/-GONA-s-Game-Paradise/', '/-GONA-s-Game-Paradise/mini-game-land/'));
      await p2.waitForSelector('[data-testid=home]');
      const hasGp = (await p2.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.')).length)) === 0;
      const back = (await p2.locator('[data-testid=back-hub]').getAttribute('href')) === '../';
      await c2.close();
      return hasGp && back;
    })());
    ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'mini-e2e-result.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
