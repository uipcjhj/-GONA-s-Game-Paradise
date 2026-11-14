#!/usr/bin/env node
/**
 * 실제 Sky Adventure(스테이지 1) ↔ 게임천국 결과 연동 브라우저 테스트
 *   (운영 빌드 그대로 + 주소에 ?dev&skytest — Sky 의 개발판 게이팅·테스트 훅)
 *   NODE_PATH=$(npm root -g) node tools/sky-e2e.cjs http://localhost:8092/-GONA-s-Game-Paradise/ out
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [base = 'http://localhost:8092/-GONA-s-Game-Paradise/', out = 'shots-sky'] = process.argv.slice(2);
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
async function mk(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
async function register(page, w, h) {
  await page.waitForSelector('.title');
  await page.touchscreen.tap(w / 2, h / 2);
  await page.fill('#gp-nick', '하늘용사');
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('radio', { name: '고나' }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.getByRole('button', { name: /게임천국 입장/ }).tap();
  await page.waitForSelector('.hit');
  await drain(page);
}
async function openSky(page) {
  const b = await page.locator('.hit').nth(2).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.popup');
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    // ── 운영 기본(주소에 ?dev 없음): Sky 는 COMING SOON, 기록/랭킹/업적도 COMING SOON
    {
      const { ctx, page, errors } = await mk(browser, w, h);
      await page.goto(base);
      await register(page, w, h);
      await openSky(page);
      ok(`[${tag}] 운영 기본: Sky 팝업 COMING SOON · 입장 불가`, (await page.locator('.popup', { hasText: 'COMING SOON' }).count()) === 1 && (await page.locator('.popup .btn-go').count()) === 0);
      await page.getByRole('button', { name: /MORE/ }).tap();
      await page.getByRole('button', { name: /업적/ }).tap();
      await page.getByRole('tab', { name: 'Sky' }).tap();
      ok(`[${tag}] 운영 기본: Sky 업적 COMING SOON 표시(진행 불가)`, (await page.locator('.p-chip.soon', { hasText: 'COMING SOON' }).count()) >= 2);
      ok(`[${tag}] 운영 기본 콘솔 오류 없음`, errors.length === 0, errors.join(' / '));
      await ctx.close();
    }
    // ── 개발판(?dev&skytest): 실제 게임 플레이 → 결과
    const { ctx, page, errors } = await mk(browser, w, h);
    await page.goto(base + '?dev&skytest');
    await register(page, w, h);
    await openSky(page);
    ok(`[${tag}] 개발판: Sky Adventure 입장 가능`, (await page.locator('.popup .btn-go').count()) === 1 && (await page.locator('.popup').innerText()).includes('Sky Adventure'));
    await shot(page, `sky-popup_${tag}`);
    await page.locator('.popup .btn-go').tap();
    await page.waitForSelector('text=SELECT WINGMATE', { timeout: 20000 });
    ok(`[${tag}] 실제 Sky 화면(동료 선택) 표시 · 가로 스크롤 없음`, await noH(page));
    await shot(page, `sky-select_${tag}`);
    const p0 = await player(page);
    ok(`[${tag}] 실행 기록(launches) 반영`, p0.stats.launches === 1);
    // 1판: 실제 플레이 → 일부러 사망(게임 오버)
    await page.getByRole('button', { name: '출격!' }).tap();
    await page.waitForFunction(() => window.__sky && window.__sky.debug().t > 2, null, { timeout: 20000 });
    await page.evaluate(() => { window.__sky.cheat('hp1'); window.__sky.cheat('hurt'); });
    await page.waitForSelector('text=SCORE', { timeout: 20000 });
    const skyScore1 = await page.evaluate(() => window.__sky && window.__sky.debug().score);
    await shot(page, `sky-gameover_${tag}`);
    await page.getByRole('button', { name: '월드맵으로' }).last().tap();
    await page.waitForSelector('text=RESULT', { timeout: 15000 });
    const rt1 = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] Sky 게임 오버 → 게임천국 결과 화면(점수·게임 오버·XP/코인)`, rt1.includes('Sky') && rt1.includes('게임 오버') && /XP|코인|짧은 판/.test(rt1), rt1.replace(/\n+/g, ' | ').slice(0, 150));
    await shot(page, `sky-result-gameover_${tag}`);
    const p1 = await player(page);
    const rec1 = p1.gameRecords['sky-battle'];
    ok(`[${tag}] Sky 기록 저장(플레이 1·클리어 0·점수=게임 점수)`, rec1 && rec1.plays === 1 && rec1.clears === 0 && rec1.bestScore === Number(skyScore1 ?? rec1.bestScore), JSON.stringify({ plays: rec1?.plays, best: rec1?.bestScore, skyScore1 }));
    await drain(page);
    // 2판: '다시 도전' → 보스 즉시 → 클리어
    await page.getByRole('button', { name: /다시 도전/ }).tap();
    await page.waitForSelector('text=SELECT WINGMATE', { timeout: 15000 });
    await page.getByRole('button', { name: '출격!' }).tap();
    await page.waitForFunction(() => window.__sky && window.__sky.debug().t > 2, null, { timeout: 20000 });
    await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('boss'); });
    await page.waitForFunction(() => window.__sky.debug().boss > 0, null, { timeout: 30000 });
    await page.evaluate(() => window.__sky.cheat('killboss'));
    await page.waitForSelector('text=STAGE CLEAR!', { timeout: 40000 });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '월드맵으로' }).last().tap();
    await page.waitForSelector('text=ADVENTURE CLEAR', { timeout: 15000 });
    const rt2 = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] Sky 클리어 → 결과 화면(ADVENTURE CLEAR · 클리어 1회)`, rt2.includes('CLEAR') && rt2.includes('1회'), rt2.replace(/\n+/g, ' | ').slice(0, 150));
    await shot(page, `sky-result-clear_${tag}`);
    await drain(page);
    const p2 = await player(page);
    const rec2 = p2.gameRecords['sky-battle'];
    ok(`[${tag}] 기록: 플레이 2·클리어 1·최고 점수 갱신 · 중복 없음`, rec2.plays === 2 && rec2.clears === 1 && p2.resultLedger.length === 2 && rec2.bestScore >= rec1.bestScore);
    ok(`[${tag}] 업적: 첫 출격 · 하늘 평정(Sky 클리어)`, !!p2.achievements.sky_first && !!p2.achievements.sky_clear, Object.keys(p2.achievements).join(','));
    ok(`[${tag}] 보상 일관성(코인·XP)`, p2.totalXP === p2.stats.totalXpEarned && p2.coinBalance === p2.stats.totalCoinsEarned);
    // 새로고침: 중복 반영 없음
    await page.reload();
    await page.waitForSelector('.title, .hit');
    ok(`[${tag}] 새로고침 후 기록 그대로(재반영 없음)`, (await player(page)).gameRecords['sky-battle'].plays === 2);
    await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});
    ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'sky-e2e-result.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
