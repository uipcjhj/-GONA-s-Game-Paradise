#!/usr/bin/env node
/**
 * Food Adventure 실연동 E2E (393×636 · 390×844): 게임천국 → 실제 Food 빌드 → 실제 플레이(게임 오버) → 돌아가기 버튼 → 결과·기록·XP·코인·업적·미션.
 * Food 정식 빌드는 /GoNa/, 개발 빌드(?test 로 게임 객체 노출)는 /GoNaDev/ 로 같은 출처에 올려 두고 시험한다(배포물 아님).
 *   (Food) npx vite build --outDir /tmp/food-prod ; VITE_CHANNEL=dev npx vite build --outDir /tmp/food-dev
 *   (게임천국) npm run build && cp -r /tmp/food-prod dist/GoNa && cp -r /tmp/food-dev dist/GoNaDev && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/platform-e2e4.cjs http://127.0.0.1:4173/ shots-p4
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', out = 'shots-p4'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const origin = new URL(url).origin;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const keys = (page, pre) => page.evaluate((pre) => Object.keys(localStorage).filter((k) => k.startsWith(pre)), pre);
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = (page, w, h, name) => page.screenshot({ path: path.join(out, `${name}_${w}x${h}.png`) });
const inboxEnvs = async (page) => Promise.all((await keys(page, 'gp.v1.inbox.')).map(async (k) => JSON.parse(await ls(page, k))));

async function register(page, w, h) {
  await page.waitForSelector('.title'); await page.touchscreen.tap(w / 2, h / 2);
  await page.fill('#gp-nick', '푸드탐험'); await page.getByRole('button', { name: /다음/ }).tap(); await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.waitForSelector('text=WELCOME!'); await page.getByRole('button', { name: /시작|입장|출발|월드/ }).first().tap().catch(() => {}); await page.waitForSelector('.hit');
}
async function openFood(page, ctx, foodPath, withTest) {
  await ctx.route(/uipcjhj\.github\.io\/GoNa\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace('${origin}${foodPath}?gp=${new URL(r.request().url()).searchParams.get('gp')}${withTest ? '&test' : ''}')</script>` }));
  const b = await page.locator('.hit').nth(1).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('[data-testid=island-popup]'); await page.waitForTimeout(1300);
  const nav = page.waitForURL((u) => u.pathname.startsWith(foodPath) && u.searchParams.has('gp'));
  await page.locator('[data-testid=island-play]').tap();
  await nav;
}
/** 프롤로그 건너뛰기 → 타이틀 → 게임 시작 → 실제 플레이 상태 */
async function startFoodRun(page) {
  // 오프닝은 첫 방문에만 나옴(재방문은 바로 타이틀) — 둘 다 허용
  await page.waitForSelector('.op-skip:visible, .cover.revealed', { timeout: 30000 });
  if (await page.locator('.op-skip').isVisible().catch(() => false)) await page.locator('.op-skip').tap();
  await page.waitForSelector('.cover.revealed', { timeout: 20000 });
  await page.waitForTimeout(2800);
  await page.locator('.cover-btn').tap();
  await page.waitForFunction(() => !document.querySelector('.cover.revealed') || true);
  await page.waitForTimeout(1500);
}
const waitOver = (page, ms = 180000) => page.waitForSelector('.over-screen:not(.hidden)', { timeout: ms });
const backBtn = (page) => page.locator('[data-gp-back]');

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await register(page, w, h);

    // ── 1. 개발 빌드: 실제 플레이 → 게임 오버(자연스러운 사망)
    await openFood(page, ctx, '/GoNaDev/', true);
    const sid = new URL(page.url()).searchParams.get('gp');
    ok(`[${tag}] 게임천국 → Food 실행(gp 세션 하나, 세션 레코드)`, !!sid && (await keys(page, 'gp.v1.session.')).length === 1);
    ok(`[${tag}] 돌아가기 버튼은 게임 중엔 보이지 않음`, (await backBtn(page).count()) === 0 || !(await backBtn(page).isVisible()));
    await startFoodRun(page);
    await shot(page, w, h, '01-food-playing');
    await waitOver(page);
    await page.waitForTimeout(500);
    const overScore = Number((await page.locator('.over-screen').innerText()).match(/(\d[\d,]*)점/)[1].replace(/,/g, ''));
    let envs = await inboxEnvs(page);
    ok(`[${tag}] 게임 오버 → inbox 에 결과 1건(failed, food-island, 단계·시간)`, envs.length === 1 && envs[0].result.outcome === 'failed' && envs[0].result.gameId === 'food-island' && envs[0].result.stage >= 1 && envs[0].result.durationMs > 0 && envs[0].sdk === 'gp-sdk/0.1');
    ok(`[${tag}] 기록된 점수 = 화면에 보인 게임 오버 점수`, envs.length === 1 && envs[0].result.score === overScore, `${overScore}`);
    ok(`[${tag}] Food 자체 저장 키는 그대로(gona-dev:*) · 게임이 쓴 gp 키는 inbox 뿐`, (await keys(page, 'gp.v1.')).filter((k) => !k.startsWith('gp.v1.inbox.') && !k.startsWith('gp.v1.session.') && !k.startsWith('gp.v1.player')).length === 0);
    ok(`[${tag}] 게임 오버 화면에 🏝 돌아가기 버튼`, await backBtn(page).isVisible());
    await shot(page, w, h, '02-food-gameover');

    // ── 2. 이어하기(점수 이어서 시작) → 이상치 검증에 안 걸림(extra.carry)
    await page.evaluate(() => localStorage.setItem('gona-dev:gona.checkpoint', JSON.stringify({ id: 'walker', score: 20000, snacks: 60, at: Date.now() })));
    // 게임 오버 화면은 이미 그려졌으므로 체크포인트 버튼을 보이게 하려면 한 번 더 죽어야 함 → 다시하기로 새 판을 시작 후 사망
    await page.locator('.over-screen .pixel-btn:not(.hidden)').filter({ hasText: /다시하기|처음부터/ }).first().tap();
    await page.waitForTimeout(1500);
    await waitOver(page);
    await page.waitForTimeout(500);
    envs = await inboxEnvs(page);
    ok(`[${tag}] 다시하기 → 새 판의 결과가 따로 기록(판마다 resultId 다름)`, envs.length === 2 && new Set(envs.map((e) => e.result.resultId)).size === 2);
    const cp = page.locator('.cp-retry:not(.hidden)');
    ok(`[${tag}] 체크포인트가 있으면 이어하기 버튼 표시(기존 Food 동작)`, (await cp.count()) === 1);
    await cp.tap();
    await page.waitForTimeout(1500);
    await waitOver(page);
    await page.waitForTimeout(500);
    envs = await inboxEnvs(page);
    const resumed = envs.find((e) => e.result.extra && e.result.extra.carry >= 20000);
    ok(`[${tag}] 이어하기 판: 시작 점수 20000 을 extra.carry 로 전달 · 점수는 그대로`, !!resumed && resumed.result.score >= 20000, resumed ? `score ${resumed.result.score} carry ${resumed.result.extra.carry}` : '');
    ok(`[${tag}] 이어하기 판의 durationMs 는 이어서 시작한 뒤 시간만`, !!resumed && resumed.result.durationMs < 120000);

    // ── 3. 엔딩(클리어): 실제 finishGame → endingStart. 다시보기 이벤트로 중복 기록 시도
    await page.evaluate(() => localStorage.removeItem('gona-dev:gona.checkpoint'));
    await page.locator('.over-screen .pixel-btn:not(.hidden)').filter({ hasText: /다시하기|처음부터/ }).first().tap();
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const g = window.__gona.scene.getScene('Game'); g.score = 2400; g.snacksEaten = 44; g.finishGame(); });
    await page.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.inbox.')).length >= 4, null, { timeout: 15000 }).catch(() => {});
    envs = await inboxEnvs(page);
    const clear = envs.find((e) => e.result.outcome === 'cleared');
    ok(`[${tag}] 엔딩 → cleared 결과 기록(단계 4, 간식 44)`, !!clear && clear.result.stage === 4 && clear.result.extra.snacks === 44 && clear.result.score === 2400);
    const before = (await keys(page, 'gp.v1.inbox.')).length;
    await page.evaluate(() => { const g = window.__gona.scene.getScene('Game'); window.__bus.emit('endingStart', g.endingInfo); window.__bus.emit('endingStart', g.endingInfo); });
    await page.waitForTimeout(600);
    ok(`[${tag}] 엔딩 다시보기(같은 이벤트 반복)로 중복 기록 안 됨`, (await keys(page, 'gp.v1.inbox.')).length === before);

    // ── 4. 게임천국 복귀 → 결과 화면 (4판 한꺼번에)
    await page.evaluate(() => { const b = document.querySelector('[data-gp-back]'); b && (b.style.display = ''); });
    await page.locator('[data-gp-back]').tap();
    await page.waitForSelector('[data-testid=result]', { timeout: 10000 });
    const rtxt = await page.locator('[data-testid=result]').innerText();
    ok(`[${tag}] 복귀 → 결과 화면(여러 판 기록됨 안내 · CLEAR)`, /\d+판이 기록됐어요/.test(rtxt));
    ok(`[${tag}] 결과 화면 가로 스크롤 없음`, await noHScroll(page));
    await shot(page, w, h, '03-paradise-result');
    const pl = await player(page);
    const rec = pl.gameRecords['food-island'];
    ok(`[${tag}] 프로필 데이터: plays·clears·최고점·최고 단계`, rec.plays === envs.length && rec.clears === 1 && rec.bestScore >= 20000 && rec.bestStage === 4);
    ok(`[${tag}] XP·코인 증가, 업적(첫 걸음·첫 클리어·Food 클리어)·도감 반영`, pl.totalXP > 0 && pl.coinBalance > 0 && !!pl.achievements['play-1'] && !!pl.achievements['clear-1'] && !!pl.achievements['food-clear'] && !!pl.codex['food-stage-4']);
    ok(`[${tag}] 미션 진행 반영(오늘의 미션/주간)`, pl.missions.weekly.find((m) => m.id === 'w-play15').value === rec.plays && (await keys(page, 'gp.v1.inbox.')).length === 0 && (await keys(page, 'gp.v1.rejected.')).length === 0);
    ok(`[${tag}] 거부된 결과 없음(정상 플레이가 이상치 검증에 안 걸림)`, (await keys(page, 'gp.v1.rejected.')).length === 0);
    await page.locator('[data-testid=result-map]').tap(); await page.waitForSelector('.hit');
    await page.locator('[data-testid=nav-profile]').tap(); await page.waitForSelector('[data-testid=stats]');
    ok(`[${tag}] 프로필 화면: Food 기록 줄 + 통계`, (await page.locator('[data-testid=rec-food-island]').innerText()).includes('판'));
    await shot(page, w, h, '04-profile');
    await page.locator('[data-testid=nav-ranking]').tap();
    ok(`[${tag}] 랭킹(이 기기): Food 기록 표시`, (await page.locator('[data-testid=rank-list] li').count()) >= 1);

    // ── 5. 정식 빌드: 실제 플레이 → 결과, 단독 실행은 기록 없음
    const before2 = await player(page);
    await page.locator('[data-testid=nav-map]').tap();
    await openFood(page, ctx, '/GoNa/', false);
    await startFoodRun(page);
    await waitOver(page);
    await page.waitForTimeout(500);
    envs = await inboxEnvs(page);
    ok(`[${tag}] 정식 빌드(개발 코드 없음)에서도 게임 오버 결과 기록`, envs.length === 1 && envs[0].result.gameId === 'food-island');
    await backBtn(page).tap();
    await page.waitForSelector('[data-testid=result]', { timeout: 10000 });
    await page.locator('[data-testid=result-map]').tap();
    const after2 = await player(page);
    ok(`[${tag}] 정식 빌드 결과도 반영(plays +1)`, after2.gameRecords['food-island'].plays === before2.gameRecords['food-island'].plays + 1);

    const solo = await ctx.newPage();
    solo.on('pageerror', (e) => errors.push('solo: ' + e.message));
    await solo.goto(`${origin}/GoNa/`);
    await startFoodRun(solo);
    await waitOver(solo);
    await solo.waitForTimeout(500);
    ok(`[${tag}] Food 단독 실행: gp 키 변화 없음 · 돌아가기 버튼 없음 · Food 최고점 저장은 기존대로`, (await keys(solo, 'gp.v1.inbox.')).length === 0 && (await solo.locator('[data-gp-back]').count()) === 0 && (await ls(solo, 'dino-snack-adventure.best')) !== null);
    ok(`[${tag}] 단독 실행 후 플레이어 데이터 불변`, JSON.stringify(await player(solo)) === JSON.stringify(after2));
    await solo.close();

    // ── 6. 만료·잘못된 세션으로 열면 no-op
    const bad = await ctx.newPage();
    await bad.goto(`${origin}/GoNa/?gp=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`);
    await bad.waitForSelector('.op-skip:visible, .cover.revealed', { timeout: 30000 });
    ok(`[${tag}] 없는 세션 ID 로 열면 연동 없이 일반 실행`, (await bad.locator('[data-gp-back]').count()) === 0 && (await keys(bad, 'gp.v1.inbox.')).length === 0);
    await bad.close();
    ok(`[${tag}] 페이지 오류 없음`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
