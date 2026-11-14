#!/usr/bin/env node
/**
 * 출시 후보 통합 e2e — 한 계정으로 Food(실제 보스전 사망)·Sky(게임 오버+클리어)·Mini(실제 라운드) 를 플레이한 뒤
 * 결과 저장 → 보상 → 프로필 → 랭킹을 확인하고, 그 '실제 플레이 데이터' 위에서 스트레스(새로고침·중복·저장 실패·백업/복원·초기화·두 탭)를 검증한다.
 * 서버: tools/live-server.cjs (Paradise 라이브 빌드 + Food 개발 빌드, 같은 출처). 온라인 랭킹은 이 테스트에서 사용하지 않는다(로컬 전용 화면 검증).
 *   NODE_PATH=$(npm root -g) node tools/rc-integration-e2e.cjs http://localhost:8090 shots-rc [393x636|390x844]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { makeInput } = require('./food-bot.cjs');
const [origin = 'http://localhost:8090', out = 'shots-rc', onlySize] = process.argv.slice(2);
const HOME = `${origin}/-GONA-s-Game-Paradise/?dev&skytest`;
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const keys = (page, p) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), p);
const noH = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
const shot = async (page, n) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${n}.png`) }); };
async function drain(page) {
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator('.p-lvup, .p-ntoast').count())) { await page.waitForTimeout(200); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
async function mkPage(browser, w, h, ctx) {
  ctx = ctx || await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|navigator\.vibrate/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
async function home(page, w, h) {
  await page.goto(HOME);
  await page.waitForSelector('.title, .hit');
  if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2);
  await page.waitForSelector('.hit, #gp-nick, .p-screen');
}
async function tapIsland(page, idx) {
  await page.waitForSelector('.hit');
  const b = await page.locator('.hit').nth(idx).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.popup');
}
async function inject(page, o = {}) {
  const r = await page.evaluate((o) => {
    const p = JSON.parse(localStorage.getItem('gp.v1.player'));
    const now = Date.now(); const rnd = () => Math.random().toString(16).slice(2, 10);
    const sid = 'sess-' + rnd() + rnd(); const rid = o.resultId || ('rid-' + rnd() + rnd());
    localStorage.setItem('gp.v1.session.' + sid, JSON.stringify({ version: 1, sessionId: sid, gameId: 'food-island', playerId: p.playerId, startedAt: new Date(now - 900000).toISOString(), expiresAt: new Date(now + 43200000).toISOString(), returnUrl: location.href }));
    const dur = 120000;
    localStorage.setItem('gp.v1.inbox.' + rid, JSON.stringify({ kind: 'gp-result', v: 1, sdk: 'e2e', result: { resultId: rid, sessionId: sid, gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'failed', score: o.score ?? 1000, stage: 2, startedAt: new Date(now - dur - 1000).toISOString(), endedAt: new Date(now - 1000).toISOString(), durationMs: dur, extra: { snacks: 10 } } }));
    window.dispatchEvent(new Event('pageshow'));
    return { rid };
  }, o);
  await page.waitForTimeout(500);
  return r;
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]].filter(([a, b]) => !onlySize || onlySize === `${a}x${b}`)) {
    const tag = `${w}x${h}`;
    const { ctx, page, errors } = await mkPage(browser, w, h);
    // ── 가입
    await home(page, w, h);
    await page.fill('#gp-nick', '통합검수');
    await page.getByRole('button', { name: /다음/ }).tap();
    await page.getByRole('radio', { name: '고나' }).tap();
    await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.getByRole('button', { name: /게임천국 입장/ }).tap();
    await page.waitForSelector('.hit');
    await drain(page);

    // ── ① Food: 실제 보스전(뽀뽀괴물) 에서 사망 → 결과
    await tapIsland(page, 1);
    await Promise.all([page.waitForURL(/\/GoNa\//), page.locator('.popup a.btn-go').tap()]);
    const gpUrl = page.url();
    await page.goto(gpUrl + '&test=kiss-boss');
    await makeInput(ctx, page);
    await page.waitForFunction(() => { const g = window.__gona; const sc = g && g.scene.getScene('Game'); return sc && sc.battle && sc.state === 'playing'; }, null, { timeout: 60000 });
    await page.waitForSelector('.over-screen', { state: 'visible', timeout: 240000 });
    await page.waitForTimeout(800);
    await home(page, w, h);
    await page.waitForSelector('text=RESULT', { timeout: 20000 });
    const rtF = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] Food 결과 화면(게임 오버 · 점수 · 보상)`, rtF.includes('Food') && rtF.includes('게임 오버') && /XP|코인|짧은 판/.test(rtF), rtF.replace(/\n+/g, ' | ').slice(0, 110));
    await shot(page, `result-food_${tag}`);
    await drain(page);
    await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});
    await page.waitForSelector('.hit');

    // ── ② Sky: 게임 오버 + 클리어
    for (const clearRun of [false, true]) {
      await tapIsland(page, 2);
      await page.locator('.popup .btn-go').tap();
      await page.getByRole('button', { name: '출격!' }).tap();
      await page.waitForFunction(() => window.__sky && window.__sky.debug().t > 2, null, { timeout: 25000 });
      if (!clearRun) {
        await page.evaluate(() => { window.__sky.cheat('hp1'); window.__sky.cheat('hurt'); });
        await page.waitForSelector('text=SCORE', { timeout: 25000 });
      } else {
        await page.evaluate(() => { window.__sky.cheat('god'); window.__sky.cheat('boss'); });
        await page.waitForFunction(() => window.__sky.debug().boss > 0, null, { timeout: 30000 });
        await page.evaluate(() => window.__sky.cheat('killboss'));
        await page.waitForSelector('text=STAGE CLEAR!', { timeout: 40000 });
        await page.waitForTimeout(800);
      }
      await page.getByRole('button', { name: '월드맵으로' }).last().tap();
      await page.waitForSelector(clearRun ? 'text=ADVENTURE CLEAR' : '.p-screen >> text=SCORE', { timeout: 15000 });
      const rt = await page.locator('.p-screen').first().innerText();
      ok(`[${tag}] Sky ${clearRun ? '클리어' : '게임 오버'} 결과 화면`, rt.includes('Sky') && rt.includes(clearRun ? 'CLEAR' : '게임 오버'), rt.replace(/\n+/g, ' | ').slice(0, 90));
      if (clearRun) await shot(page, `result-sky-clear_${tag}`);
      await drain(page);
      await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});
      await page.waitForSelector('.hit');
    }

    // ── ③ Mini: 실제 라운드(편가르기, 시간 초과)
    await tapIsland(page, 3);
    await Promise.all([page.waitForURL(/mini-game-land/), page.locator('.popup .btn-go').tap()]);
    await page.waitForSelector('[data-testid=home]');
    await page.locator('[data-testid=go-free]').tap();
    await page.locator('[data-testid=pick-sort]').tap();
    await page.locator('[data-testid=start]').tap();
    await page.waitForSelector('[data-testid=result]', { timeout: 150000 });
    await page.waitForTimeout(600);
    await home(page, w, h);
    await page.waitForSelector('text=RESULT', { timeout: 20000 });
    const rtM = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] Mini 결과 화면`, rtM.includes('Mini'), rtM.replace(/\n+/g, ' | ').slice(0, 90));
    await drain(page);
    await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});
    await page.waitForSelector('.hit');

    // ── 집계 확인: 기록 · 보상 · 프로필 · 랭킹
    const p0 = await player(page);
    const rec = p0.gameRecords;
    ok(`[${tag}] 게임별 기록: Food 1판 · Sky 2판(클리어 1) · Mini 1판`, rec['food-island']?.plays === 1 && rec['sky-battle']?.plays === 2 && rec['sky-battle']?.clears === 1 && rec['minigame-paradise']?.plays === 1, JSON.stringify(Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, [v.plays, v.clears, v.bestScore]]))));
    ok(`[${tag}] 원장 4건 · inbox 비움 · 세션/보상 일관(XP·코인 = 누적 지급)`, p0.resultLedger.length === 4 && (await keys(page, 'gp.v1.inbox.')).length === 0 && p0.totalXP === p0.stats.totalXpEarned && p0.coinBalance === p0.stats.totalCoinsEarned, `ledger ${p0.resultLedger.length} XP ${p0.totalXP} coin ${p0.coinBalance}`);
    ok(`[${tag}] 업적: 세 게임 첫 플레이 · Sky 클리어 반영`, !!p0.achievements.sky_first && !!p0.achievements.sky_clear && !!p0.achievements.first_adventure, Object.keys(p0.achievements).join(','));
    await page.getByRole('button', { name: /PROFILE/ }).tap();
    await page.waitForSelector('.p-pcard');
    const pf = await page.locator('.p-screen').innerText();
    ok(`[${tag}] 프로필: 닉네임 · 레벨 · 게임별 기록`, pf.includes('통합검수') && /LV/.test(pf) && pf.includes('Sky'), '');
    ok(`[${tag}] 프로필 가로 스크롤 없음`, await noH(page));
    await shot(page, `profile_${tag}`);
    await page.getByRole('button', { name: /RANKING/ }).tap();
    await page.waitForSelector('.p-tabs');
    const skyBest = rec['sky-battle'].bestScore.toLocaleString('ko-KR');
    await page.getByRole('tab', { name: 'Sky' }).tap();
    ok(`[${tag}] 랭킹(Sky 탭): 내 최고 ${skyBest} · 로컬 표시(온라인 미연결) · 가짜 순위 없음`, (await page.locator('.p-screen').innerText()).includes(skyBest) && !/\b1위|2위|3위/.test(await page.locator('.p-screen').innerText()));
    await page.getByRole('tab', { name: 'Mini' }).tap();
    ok(`[${tag}] 랭킹(Mini 탭) 표시`, (await page.locator('.p-screen').innerText()).length > 20);
    await shot(page, `ranking_${tag}`);
    await page.getByRole('button', { name: /MAP/ }).tap().catch(() => {});

    // ── 스트레스 1: 새로고침 — 재반영 없음
    await page.reload(); await page.waitForSelector('.title, .hit');
    const p1 = await player(page);
    ok(`[${tag}] 새로고침: XP·코인·기록 그대로`, p1.totalXP === p0.totalXP && p1.coinBalance === p0.coinBalance && p1.resultLedger.length === 4);
    // ── 스트레스 2: 이미 반영된 결과 ID 재수신 — 중복 무시
    if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2);
    await page.waitForSelector('.hit');
    await inject(page, { resultId: p1.resultLedger[0], score: 5000 });
    await page.waitForTimeout(500); await drain(page);
    const p2 = await player(page);
    ok(`[${tag}] 중복 결과(같은 resultId) 재수신 → 반영 안 함 · inbox 정리`, p2.totalXP === p1.totalXP && p2.resultLedger.length === 4 && (await keys(page, 'gp.v1.inbox.')).length === 0);
    // ── 스트레스 3: 저장 공간 부족
    await page.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === 'gp.v1.player' && window.__block) throw new DOMException('quota', 'QuotaExceededError'); return window.__origSet.call(this, k, v); }; window.__block = true; });
    await inject(page, { score: 777 });
    await page.waitForSelector('text=저장 실패');
    ok(`[${tag}] 저장 실패: 안내 화면 + 결과는 inbox 에 보관, 기록 불변`, (await keys(page, 'gp.v1.inbox.')).length === 1 && (await player(page)).resultLedger.length === 4);
    await shot(page, `save-failed_${tag}`);
    await page.evaluate(() => { window.__block = false; });
    await page.getByRole('button', { name: '다시 시도' }).tap();
    await page.waitForTimeout(600); await drain(page);
    const p3 = await player(page);
    ok(`[${tag}] 다시 시도 → 한 번만 반영`, p3.resultLedger.length === 5 && p3.gameRecords['food-island'].plays === 2 && (await keys(page, 'gp.v1.inbox.')).length === 0);
    await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});
    // ── 스트레스 4: 백업 → 초기화 → 가입 화면에서 복원
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.waitForSelector('text=데이터 백업');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '파일로 백업' }).tap()]);
    const bp = path.join(out, `backup_${tag}.json`); await dl.saveAs(bp);
    const live = await player(page);
    await page.evaluate(() => { localStorage.setItem('dino-snack-adventure.best', '777'); });
    await page.getByRole('button', { name: '초기화', exact: true }).tap();
    await page.getByRole('button', { name: '계속' }).tap();
    await page.getByRole('button', { name: '모두 삭제' }).tap();
    await page.waitForSelector('text=NEW PLAYER');
    ok(`[${tag}] 초기화: gp.v1.* 전부 삭제 · Food/기존 키 보존`, !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.')))) && (await ls(page, 'dino-snack-adventure.best')) === '777');
    await shot(page, `register-restore_${tag}`);
    ok(`[${tag}] 가입 화면: 가로 스크롤 없음 · 복원 버튼 표시`, (await noH(page)) && (await page.getByTestId('reg-restore').isVisible()));
    await page.locator('input[type=file]').setInputFiles(bp);
    await page.waitForSelector('.hit', { timeout: 8000 });
    const back = await player(page);
    ok(`[${tag}] 백업 복원(가입 화면) → 기록·코인·업적·칭호 동일`, JSON.stringify(back.gameRecords) === JSON.stringify(live.gameRecords) && back.coinBalance === live.coinBalance && back.totalXP === live.totalXP && Object.keys(back.achievements).join() === Object.keys(live.achievements).join() && back.titleId === live.titleId && back.nickname === live.nickname);
    await drain(page);
    // ── 스트레스 5: 두 탭 동시 수신
    const B = await mkPage(browser, w, h, ctx);
    await B.page.goto(HOME); await B.page.waitForSelector('.title, .hit');
    if (await B.page.locator('.title').count()) await B.page.touchscreen.tap(w / 2, h / 2);
    await B.page.waitForSelector('.hit');
    const base = (await player(page)).gameRecords['food-island'].plays;
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('gp.v1.player')); const now = Date.now(); const sid = 'sess-twotab-rc01'; const rid = 'rid-twotab-rc01';
      localStorage.setItem('gp.v1.session.' + sid, JSON.stringify({ version: 1, sessionId: sid, gameId: 'food-island', playerId: p.playerId, startedAt: new Date(now - 900000).toISOString(), expiresAt: new Date(now + 43200000).toISOString(), returnUrl: location.href }));
      localStorage.setItem('gp.v1.inbox.' + rid, JSON.stringify({ kind: 'gp-result', v: 1, result: { resultId: rid, sessionId: sid, gameId: 'food-island', gameVersion: '1', scoreSchemaVersion: 1, outcome: 'failed', score: 3000, stage: 2, startedAt: new Date(now - 100000).toISOString(), endedAt: new Date(now - 1000).toISOString(), durationMs: 99000, extra: { snacks: 5 } } }));
    });
    await Promise.all([page.evaluate(() => window.dispatchEvent(new Event('pageshow'))), B.page.evaluate(() => window.dispatchEvent(new Event('pageshow')))]);
    await page.waitForTimeout(900); await B.page.waitForTimeout(900);
    const pa = await player(page);
    ok(`[${tag}] 두 탭 동시 수신 → 한 번만 반영(plays +1)`, pa.gameRecords['food-island'].plays === base + 1 && pa.resultLedger.filter((x) => x === 'rid-twotab-rc01').length === 1);
    ok(`[${tag}] 전체 흐름 콘솔 오류 없음`, errors.length === 0 && B.errors.length === 0, [...errors, ...B.errors].slice(0, 3).join(' / '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, `rc-result-${onlySize || 'all'}.json`), JSON.stringify({ results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
