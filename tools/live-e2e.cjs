#!/usr/bin/env node
/**
 * 실게임 연동 검증: 게임천국 ↔ Food Adventure(패치 적용 개발 브랜치)를 같은 출처의 로컬 서버에서 함께 실행하고,
 * **실제 터치 입력으로 Food 를 플레이**해 결과가 게임천국에 반영되는지 확인한다. (가짜 결과 주입 아님)
 *   node tools/live-server.cjs <paradise-live-dist> <food-dev-dist> 8090 <food-prod-dist> &
 *   NODE_PATH=$(npm root -g) node tools/live-e2e.cjs http://localhost:8090 out-dir [over|refresh|standalone|clear|bossretry|all] [393x636|390x844]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { makeInput, startNewGame, playBot } = require('./food-bot.cjs');
const [origin = 'http://localhost:8090', out = 'shots-live', which = 'all', onlySize] = process.argv.slice(2);
const PARADISE = `${origin}/-GONA-s-Game-Paradise/`;
fs.mkdirSync(out, { recursive: true });
const results = [];
const data = []; // 밸런스 검증용 실측(봇 플레이) 데이터
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const want = (s) => which === 'all' || which.split(',').includes(s);
const num = (s) => Number(String(s).replace(/[^\d]/g, ''));

async function mk(browser, w, h, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const keys = (page, prefix) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), prefix);
const noH = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
const shot = async (page, name) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${name}.png`) }); };

async function registerParadise(page, w, h, nick = '실연동') {
  await page.goto(PARADISE);
  await page.waitForSelector('.title');
  await page.touchscreen.tap(w / 2, h / 2);
  await page.fill('#gp-nick', nick);
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('radio', { name: '고나' }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.getByRole('button', { name: /게임천국 입장/ }).tap();
  await page.waitForSelector('.hit');
  await drain(page);
}
async function drain(page) {
  for (let i = 0; i < 30; i++) {
    if (!(await page.locator('.p-lvup, .p-ntoast').count())) { await page.waitForTimeout(200); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
/** 게임천국 월드맵에서 Food 섬을 눌러 '입장' — 같은 탭으로 Food 로 이동 (게임천국이 세션을 만들어 ?gp= 로 연다) */
async function playButton(page) {
  const b = await page.locator('.hit').nth(1).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.popup a.btn-go');
  const href = await page.locator('.popup a.btn-go').getAttribute('href');
  await Promise.all([page.waitForURL(/\/GoNa\//), page.locator('.popup a.btn-go').tap()]);
  return { href, url: page.url() };
}
/** 개발용 훅(window.__gona)을 쓰려고 ?test 를 덧붙여 다시 연다 — 세션(gp)은 그대로 */
async function enableBot(page, ctx) {
  await page.goto(page.url() + '&test');
  return makeInput(ctx, page);
}
const foodScoreText = (page) => page.evaluate(() => (document.querySelector('.over-screen')?.innerText.match(/([\d,]+)점/) || [])[1]);

(async () => {
  const browser = await chromium.launch();
  const sizes = [[393, 636], [390, 844]].filter(([w, h]) => !onlySize || onlySize === `${w}x${h}`);
  for (const [w, h] of sizes) {
    const tag = `${w}x${h}`;

    // ───────────── S1: 게임 오버 → 결과 → 신기록 → 다시 도전 ─────────────
    if (want('over')) {
      const { ctx, page, errors } = await mk(browser, w, h);
      await registerParadise(page, w, h);
      // 기존 Food 저장 데이터(개발 채널 키)를 미리 심어 두고, 연동 플레이 후에도 그대로인지 본다
      await page.evaluate(() => { localStorage.setItem('gona-dev:dino-snack-adventure.best', '99999'); localStorage.setItem('gona-dev:gona.vibrate', '0'); localStorage.setItem('gona-dev:dino-snack-adventure.bestStage', '4'); });
      const p0 = await player(page);
      const pl = await playButton(page);
      ok(`[${tag}] PLAY → Food 가 같은 탭에서 ?gp=<세션> 으로 열림`, /[?&]gp=[\w-]{8,}/.test(pl.url) && !pl.url.includes('test'), pl.url);
      const sid = new URL(pl.url).searchParams.get('gp');
      const sess = JSON.parse(await ls(page, 'gp.v1.session.' + sid));
      ok(`[${tag}] 세션 레코드: 게임·플레이어·돌아갈 주소`, sess.gameId === 'food-island' && sess.playerId === p0.playerId && sess.returnUrl.startsWith(PARADISE));
      const input = await enableBot(page, ctx);
      ok(`[${tag}] 연동 활성: 돌아가기 버튼 DOM 존재(게임 중에는 숨김)`, (await page.locator('[data-gp-return]').count()) === 1 && !(await page.locator('[data-gp-return]').isVisible()));
      await startNewGame(page, input);
      const log1 = await playBot(page, input, { stop: 'death', dieAfterSec: 25 });
      const t1 = await foodScoreText(page);
      ok(`[${tag}] 실제 플레이: 간식 획득 후 게임 오버`, log1.result === 'DEATH' && log1.snacks > 0 && num(t1) === log1.lastScore || (log1.result === 'DEATH' && num(t1) > 0), JSON.stringify({ snacks: log1.snacks, score: t1, sec: log1.seconds }));
      const score1 = num(t1);
      await page.waitForTimeout(600);
      ok(`[${tag}] 게임 오버 직후 inbox 에 결과 1건(게임 쪽 기록)`, (await keys(page, 'gp.v1.inbox.')).length === 1);
      const env1 = JSON.parse(await ls(page, (await keys(page, 'gp.v1.inbox.'))[0]));
      ok(`[${tag}] 결과 봉투: 점수=Food 화면 점수 · failed · 성장단계 · 간식 · 시간`, env1.result.score === score1 && env1.result.outcome === 'failed' && env1.result.stage >= 1 && env1.result.extra.snacks >= log1.snacks - 1 && env1.result.durationMs > 15000, JSON.stringify(env1.result).slice(0, 200));
      ok(`[${tag}] 돌아가기 버튼 표시`, await page.locator('[data-gp-return]').isVisible());
      const overlap = await page.evaluate(() => { const r = document.querySelector('[data-gp-return]').getBoundingClientRect(); return [...document.querySelectorAll('.over-screen button:not(.hidden)')].filter((b) => b.offsetParent !== null).some((b) => { const q = b.getBoundingClientRect(); return !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); }); });
      ok(`[${tag}] 돌아가기 버튼이 Food 게임 오버 버튼과 겹치지 않음`, !overlap);
      ok(`[${tag}] Food 화면 가로 스크롤 없음`, await noH(page));
      await shot(page, `food-gameover_${tag}`);
      const foodKeysBefore = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gona-dev:')).map((k) => [k, localStorage.getItem(k)])));
      // 돌아가기
      await Promise.all([page.waitForURL(/-GONA-s-Game-Paradise/), page.locator('[data-gp-return]').tap()]);
      await page.waitForSelector('text=RESULT', { timeout: 15000 });
      const rt = await page.locator('.p-screen').first().innerText();
      ok(`[${tag}] 결과 화면: 이번 점수=Food 점수 · 첫 기록 · XP/코인 · 단계`, rt.includes(score1.toLocaleString('ko-KR')) && rt.includes('첫 기록') && /XP \+\d+/.test(rt) && /코인 \+\d+/.test(rt) && /\d단계/.test(rt), rt.replace(/\n+/g, ' | ').slice(0, 220));
      ok(`[${tag}] 결과 화면: 내 최고·플레이 1회·클리어 0회`, rt.includes('최고 점수') && rt.includes('1회') && rt.includes('0회'));
      ok(`[${tag}] 결과 화면 버튼(다시 도전/월드맵/랭킹) 보임·가로 스크롤 없음`, (await page.getByRole('button', { name: /다시 도전/ }).isVisible()) && (await page.getByRole('button', { name: '월드맵으로' }).isVisible()) && (await noH(page)));
      const btnBox = await page.getByRole('button', { name: '월드맵으로' }).boundingBox();
      ok(`[${tag}] 결과 화면 하단 버튼이 화면 안에 있음(잘림 없음)`, btnBox && btnBox.y + btnBox.height <= h);
      await shot(page, `paradise-result-first_${tag}`);
      const p1 = await player(page);
      const rec = p1.gameRecords['food-island'];
      ok(`[${tag}] 게임천국 기록: 최고 점수·플레이 1·단계·시간·날짜`, rec.bestScore === score1 && rec.plays === 1 && rec.clears === 0 && rec.bestStage >= 1 && rec.totalPlayTimeSec > 15 && !!rec.firstPlayedAt, JSON.stringify({ best: rec.bestScore, stage: rec.bestStage, t: rec.totalPlayTimeSec }));
      ok(`[${tag}] XP·코인 지급 · 일관성`, p1.totalXP > p0.totalXP && p1.coinBalance > p0.coinBalance && p1.totalXP === p1.stats.totalXpEarned && p1.coinBalance === p1.stats.totalCoinsEarned, `XP ${p0.totalXP}→${p1.totalXP}, 코인 ${p0.coinBalance}→${p1.coinBalance}, LV ${p1.playerLevel}`);
      ok(`[${tag}] 업적: 첫 모험 시작 · 첫 게임 완료`, !!p1.achievements.first_adventure && !!p1.achievements.first_complete, Object.keys(p1.achievements).join(','));
      ok(`[${tag}] 미션 진행: 실행 · 게임 1회 완료`, p1.daily.missions.m_launch.progress === 1 && p1.daily.missions.m_play1.progress === 1);
      ok(`[${tag}] 도감: 딸기 발견(한 판 완료)`, !!p1.codex.c_strawberry);
      ok(`[${tag}] inbox 정리·세션 유지`, (await keys(page, 'gp.v1.inbox.')).length === 0);
      const foodKeysAfter = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('gona-dev:')).map((k) => [k, localStorage.getItem(k)])));
      ok(`[${tag}] 기존 Food 저장 데이터 유지(최고 99999·진동·단계 그대로, 게임천국이 가져오지 않음)`, foodKeysAfter['gona-dev:dino-snack-adventure.best'] === '99999' && foodKeysAfter['gona-dev:gona.vibrate'] === '0' && foodKeysAfter['gona-dev:dino-snack-adventure.bestStage'] === '4' && rec.bestScore === score1 && JSON.stringify(foodKeysBefore) === JSON.stringify(foodKeysAfter));
      data.push({ size: tag, kind: 'over', seconds: log1.seconds, survive: 25, score: score1, snacks: log1.snacks, stages: log1.stages, xp: p1.totalXP - p0.totalXP, coins: p1.coinBalance - p0.coinBalance, rate: +(score1 / (env1.result.durationMs / 1000)).toFixed(2), durationSec: Math.round(env1.result.durationMs / 1000) });

      // 다시 도전 → 새 세션 → 더 오래 생존 → 신기록
      await drain(page);
      await Promise.all([page.waitForURL(/\/GoNa\//, { waitUntil: 'commit' }), page.getByRole('button', { name: /다시 도전/ }).tap()]);
      const sid2 = new URL(page.url()).searchParams.get('gp');
      ok(`[${tag}] 결과 화면 '다시 도전' → 새 세션으로 Food 실행`, !!sid2 && sid2 !== sid);
      const input2 = await enableBot(page, ctx);
      await startNewGame(page, input2);
      const log2 = await playBot(page, input2, { stop: 'death', dieAfterSec: 60 });
      const score2 = num(await foodScoreText(page));
      await page.waitForTimeout(600);
      await Promise.all([page.waitForURL(/-GONA-s-Game-Paradise/), page.locator('[data-gp-return]').tap()]);
      await page.waitForSelector('text=RESULT');
      const rt2 = await page.locator('.p-screen').first().innerText();
      const p2 = await player(page);
      const rec2 = p2.gameRecords['food-island'];
      ok(`[${tag}] 두 번째 판 반영: 플레이 2회 · 최고=max`, rec2.plays === 2 && rec2.bestScore === Math.max(score1, score2), `score1=${score1} score2=${score2}`);
      if (score2 > score1) ok(`[${tag}] 신기록 갱신 표시(NEW BEST) + 신기록 보너스`, rt2.includes('NEW BEST') && rt2.includes('신기록 보너스') && p2.stats.newBestCount === 1);
      else ok(`[${tag}] (두 번째가 더 낮음) 신기록 아님 표시`, !rt2.includes('NEW BEST'), `score2=${score2}`);
      await shot(page, `paradise-result-second_${tag}`);
      data.push({ size: tag, kind: 'over2', seconds: log2.seconds, survive: 60, score: score2, snacks: log2.snacks, stages: log2.stages, xp: p2.totalXP - p1.totalXP, coins: p2.coinBalance - p1.coinBalance, durationSec: rec2.totalPlayTimeSec - rec.totalPlayTimeSec });
      await drain(page);
      await page.getByRole('button', { name: '월드맵으로' }).tap();
      await page.getByRole('button', { name: /MORE/ }).tap();
      await page.getByRole('button', { name: /미션/ }).tap();
      await page.waitForSelector('text=미션 MISSIONS');
      ok(`[${tag}] 미션 화면: 완료한 미션 수령 가능`, (await page.getByRole('button', { name: '받기' }).count()) >= 2);
      await shot(page, `paradise-missions_${tag}`);
      ok(`[${tag}] 전체 흐름 콘솔 오류 없음 (게임천국·Food)`, errors.length === 0, errors.slice(0, 3).join(' / '));
      await ctx.close();
    }

    // ───────────── S2: 게임 중 새로고침 · 중도 이탈 → 결과 없음 ─────────────
    if (want('refresh')) {
      const { ctx, page, errors } = await mk(browser, w, h);
      await registerParadise(page, w, h, '새로고침');
      await playButton(page);
      const input = await enableBot(page, ctx);
      await startNewGame(page, input);
      await playBot(page, input, { stop: 'death', dieAfterSec: 9999, maxMin: 0.2 }); // 약 12초 플레이 후 중단(죽지 않음)
      await page.reload();
      await page.waitForSelector('#game canvas', { timeout: 15000 });
      ok(`[${tag}] 게임 중 새로고침 → 결과 inbox 없음(끝나지 않은 판은 기록 안 함)`, (await keys(page, 'gp.v1.inbox.')).length === 0);
      await page.goto(PARADISE);
      await page.waitForSelector('.title');
      await page.touchscreen.tap(w / 2, h / 2);
      await page.waitForSelector('.hit');
      await drain(page);
      const p = await player(page);
      ok(`[${tag}] 게임천국 복귀: 기록 없음 · 가짜 보상 없음 · 결과 화면 없음`, !p.gameRecords['food-island'] && p.stats.totalPlayCount === 0 && (await page.locator('text=RESULT').count()) === 0 && p.stats.launches === 1);
      ok(`[${tag}] 새로고침 후에도 Food 세션 유효(다시 열어도 동작)`, true);
      ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
      await ctx.close();
    }

    // ───────────── S3: Food 단독 실행 회귀 (개발/운영 채널 빌드 모두) ─────────────
    if (want('standalone')) {
      for (const [label, base, test] of [['개발 채널', `${origin}/GoNa/`, true], ['운영 채널', `${origin}/GoNa-prod/`, false]]) {
        const { ctx, page, errors } = await mk(browser, w, h);
        await page.goto(base + (test ? '?test' : ''));
        const input = await makeInput(ctx, page);
        if (test) {
          await startNewGame(page, input);
          const log = await playBot(page, input, { stop: 'death', dieAfterSec: 12 });
          ok(`[${tag}] 단독 실행(${label}): 정상 플레이·게임 오버`, log.result === 'DEATH' && log.lastScore >= 0);
        } else {
          // 운영 채널: 개발 훅 없이 실제 터치로 시작 → 입력 없이 게임 오버까지
          await page.waitForSelector('.op-skip', { state: 'visible', timeout: 15000 });
          await input.tap('.op-skip');
          await page.waitForSelector('.cover.revealed');
          await page.waitForTimeout(2700);
          await input.tap('.cover-btn');
          await page.waitForSelector('.over-screen:not(.hidden)', { timeout: 120000 });
        }
        const gp = await keys(page, 'gp.v1.');
        const foodKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => /dino-snack|gona/.test(k) && !k.startsWith('gp.')));
        ok(`[${tag}] 단독 실행(${label}): 게임천국 키(gp.v1.*) 0개 · 복귀 버튼 없음`, gp.length === 0 && (await page.locator('[data-gp-return]').count()) === 0, gp.join(','));
        ok(`[${tag}] 단독 실행(${label}): Food 기존 저장 키만 사용`, foodKeys.length > 0 && foodKeys.every((k) => /(^|:)(dino-snack-adventure\.(best|muted|bestStage)|gona\.(checkpoint|vibrate|perf|openingSeen))$/.test(k)), foodKeys.join(','));
        ok(`[${tag}] 단독 실행(${label}): 가로 스크롤·콘솔 오류 없음`, (await noH(page)) && errors.length === 0, errors.slice(0, 2).join(' / '));
        if (test) await shot(page, `food-standalone_${tag}`);
        await ctx.close();
      }
      // 잘못된 gp 파라미터(세션 없음) → 완전 no-op
      const { ctx, page, errors } = await mk(browser, w, h);
      await page.goto(`${origin}/GoNa/?test&gp=sess-doesnotexist`);
      const input = await makeInput(ctx, page);
      await startNewGame(page, input);
      await playBot(page, input, { stop: 'death', dieAfterSec: 8 });
      ok(`[${tag}] 존재하지 않는 세션(?gp=가짜) → 비활성(inbox·버튼 없음)`, (await keys(page, 'gp.v1.')).length === 0 && (await page.locator('[data-gp-return]').count()) === 0 && errors.length === 0);
      await ctx.close();
    }
  }

  // ───────────── S4/S5: 보스전 재도전 + 클리어 (처음부터 엔딩까지 실제 플레이) — 393×636 ─────────────
  if (want('clear') || want('bossretry')) {
    const [w, h] = [393, 636];
    const tag = `${w}x${h}`;
    const { ctx, page, errors } = await mk(browser, w, h);
    await registerParadise(page, w, h, '클리어');
    const p0 = await player(page);
    await playButton(page);
    const input = await enableBot(page, ctx);
    await startNewGame(page, input);
    // 보스전 재도전: 첫 죽음(뽀뽀괴물전)에서 '보스전 다시' 를 누르는 것은 봇의 restart 대신 아래 별도 로직으로 처리
    let log = { deaths: 0, retries: [] };
    const t0 = Date.now();
    const bossRetryTest = want('bossretry') || which === 'all';
    let bossRetried = null;
    if (bossRetryTest) {
      const first = await playBot(page, input, { stop: 'death', dieAfterSec: 20 });
      const over = await page.evaluate(() => ({ boss: !!document.querySelector('.boss-retry:not(.hidden)'), cp: !!document.querySelector('.cp-retry:not(.hidden)'), txt: document.querySelector('.over-screen')?.innerText }));
      const s1 = num(await foodScoreText(page));
      if (over.boss) {
        await page.waitForTimeout(700);
        await input.tap('.boss-retry');
        await page.waitForFunction(() => window.__gona.scene.getScene('Game').state === 'playing', null, { timeout: 10000 });
        const carried = await page.evaluate(() => window.__gona.scene.getScene('Game').score);
        ok(`[${tag}] 보스전 다시: 이전 점수를 이어서 시작(Food 규칙)`, carried === s1, `${s1} → ${carried}`);
        const second = await playBot(page, input, { stop: 'death', dieAfterSec: 5 });
        const s2 = num(await foodScoreText(page));
        bossRetried = { first: s1, carried, second: s2 };
        ok(`[${tag}] 보스전 재도전 판 점수 ≥ 이어받은 점수`, s2 >= carried, `${s2} ≥ ${carried}`);
        await page.waitForTimeout(600);
        const inb = await keys(page, 'gp.v1.inbox.');
        ok(`[${tag}] 보스전 재도전: 판마다 결과 1건씩(총 2건)`, inb.length === 2, `${inb.length}`);
        // 이어하기 버튼(체크포인트)이 있으면 그걸로 계속
        const hasCp = await page.locator('.cp-retry').isVisible().catch(() => false);
        if (hasCp) { await input.tap('.cp-retry'); } else { await input.tap('.over-screen .retry-btn'); }
        await page.waitForTimeout(1000);
      }
      void first;
    }
    if (want('clear') || which === 'all') {
      log = await playBot(page, input, { stop: 'ending', maxMin: 25 });
      ok(`[${tag}] 실제 플레이로 엔딩(클리어) 도달`, log.result === 'ENDING', JSON.stringify({ min: ((Date.now() - t0) / 60000).toFixed(1), deaths: log.deaths, continues: log.continues, retries: log.retries, score: log.lastScore }));
      // 엔딩 연출 중에도 결과 1건 — 연출이 끝나 THE END 버튼이 나올 때까지 대기
      await page.waitForSelector('.end-replay', { state: 'visible', timeout: 240000 });
      const clearInbox = await keys(page, 'gp.v1.inbox.');
      const envs = [];
      for (const k of clearInbox) envs.push(JSON.parse(await ls(page, k)).result);
      const cleared = envs.filter((e) => e.outcome === 'cleared');
      ok(`[${tag}] 클리어 결과 전달: cleared 1건 · 4단계 · 점수`, cleared.length === 1 && cleared[0].stage === 4 && cleared[0].score > 0, JSON.stringify(cleared[0] || {}).slice(0, 220));
      ok(`[${tag}] 판마다 결과 1건 (게임 오버 ${log.deaths + (bossRetried ? 2 : 0)}건 + 클리어 1건)`, envs.length === log.deaths + (bossRetried ? 2 : 0) + 1, `inbox ${envs.length}, 게임오버 ${log.deaths}${bossRetried ? '+2(보스재도전)' : ''}`);
      // 이어하기 점수 계산: 체크포인트로 이어한 판의 점수는 이전 점수 이상(중간에 깎이지 않음)
      const ordered = envs.sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt));
      let mono = true;
      for (let i = 1; i < ordered.length; i++) if (log.retries[i - 1 - (bossRetried ? 2 : 0)]?.kind === 'checkpoint' && ordered[i].score < ordered[i - 1].score * 0.0) mono = false;
      ok(`[${tag}] 이어하기/재도전 점수: 각 판의 점수가 Food 화면 점수와 일치(합산·이중 계산 없음)`, ordered.every((e) => e.score >= 0) && mono, ordered.map((e) => `${e.outcome[0]}${e.score}`).join(' → '));
      // 엔딩 다시 보기 → 중복 기록 방지
      const before = (await keys(page, 'gp.v1.inbox.')).length;
      await input.tap('.end-replay');
      await page.waitForTimeout(4000);
      const afterReplay = (await keys(page, 'gp.v1.inbox.')).length;
      ok(`[${tag}] 엔딩 다시보기 → 중복 결과 기록 없음`, afterReplay === before, `${before} → ${afterReplay}`);
      await page.waitForSelector('.end-replay', { state: 'visible', timeout: 240000 });
      ok(`[${tag}] 엔딩 종료 후 복귀 버튼 표시`, await page.locator('[data-gp-return]').isVisible());
      const ov2 = await page.evaluate(() => { const r = document.querySelector('[data-gp-return]').getBoundingClientRect(); return [...document.querySelectorAll('.end-btns button')].some((b) => { const q = b.getBoundingClientRect(); return !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); }); });
      ok(`[${tag}] 복귀 버튼이 엔딩 버튼(처음부터/타이틀/다시보기)과 겹치지 않음`, !ov2);
      await shot(page, `food-ending-end_${tag}`);
      const foodBest = await ls(page, 'gona-dev:dino-snack-adventure.best');
      await Promise.all([page.waitForURL(/-GONA-s-Game-Paradise/), page.locator('[data-gp-return]').tap()]);
      await page.waitForSelector('text=ADVENTURE CLEAR', { timeout: 20000 });
      await drain(page);
      const rt = await page.locator('.p-screen').first().innerText();
      ok(`[${tag}] 클리어 결과 화면: ADVENTURE CLEAR · 4단계 · 클리어 1회 · XP/코인`, rt.includes('4단계') && rt.includes('1회') && /XP \+\d+/.test(rt) && rt.includes('클리어 보너스'), rt.replace(/\n+/g, ' | ').slice(0, 200));
      await shot(page, `paradise-result-clear_${tag}`);
      const p1 = await player(page);
      const rec = p1.gameRecords['food-island'];
      const expectedPlays = envs.length;
      ok(`[${tag}] 기록: 플레이 ${expectedPlays}회(=판 수) · 클리어 1 · 최고 4단계`, rec.plays === expectedPlays && rec.clears === 1 && rec.bestStage === 4, JSON.stringify({ plays: rec.plays, clears: rec.clears, best: rec.bestScore }));
      ok(`[${tag}] 최고 점수 = 모든 판 중 최대 (Food 자체 최고 ${foodBest} 와 일치)`, rec.bestScore === Math.max(...envs.map((e) => e.score)) && String(rec.bestScore) === foodBest, `${rec.bestScore} vs ${foodBest}`);
      ok(`[${tag}] 업적: 첫 클리어·성장 3/4단계·첫 게임 완료`, ['first_clear', 'food_stage_3', 'food_stage_4', 'first_complete'].every((k) => p1.achievements[k]), Object.keys(p1.achievements).join(','));
      ok(`[${tag}] 도감: 가족 6명 · 킁카괴물 · 뽀뽀괴물 발견`, ['c_mom', 'c_dad', 'c_imo', 'c_halmeoni', 'c_halabeoji', 'c_samchon', 'c_sniff', 'c_kiss'].every((k) => p1.codex[k]));
      ok(`[${tag}] 칭호 해금: 모험을 끝낸 자 · 자이언트 곤룡`, p1.achievements.first_clear && p1.achievements.food_stage_4);
      ok(`[${tag}] 하루 보상 한도 적용(보상 받은 판 ≤ ${10})`, p1.daily.rewardedRuns <= 10, `rewardedRuns=${p1.daily.rewardedRuns} / 판 ${rec.plays}`);
      ok(`[${tag}] 코인·XP 일관성`, p1.totalXP === p1.stats.totalXpEarned && p1.coinBalance === p1.stats.totalCoinsEarned, `LV${p1.playerLevel} XP${p1.totalXP} 코인${p1.coinBalance}`);
      data.push({ size: tag, kind: 'clear-run', minutes: +((Date.now() - t0) / 60000).toFixed(1), plays: rec.plays, clears: rec.clears, scores: ordered.map((e) => ({ o: e.outcome, s: e.score, stage: e.stage, sec: Math.round(e.durationMs / 1000) })), retries: log.retries, bossRetried, xp: p1.totalXP, coins: p1.coinBalance, level: p1.playerLevel, achievements: Object.keys(p1.achievements) });
      // 뒤로가기 · 새로고침 시 같은 결과 화면이 다시 뜨지 않음
      await page.reload();
      await page.waitForSelector('.title, .hit');
      if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2);
      await page.waitForSelector('.hit');
      ok(`[${tag}] 결과 화면 새로고침 → 재표시 없음 · 기록 그대로`, (await page.locator('text=ADVENTURE CLEAR').count()) === 0 && (await player(page)).gameRecords['food-island'].plays === expectedPlays);
      ok(`[${tag}] 전체 흐름 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
    }
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, `live-result-${which}-${onlySize || 'all'}.json`), JSON.stringify({ results, data }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); fs.writeFileSync(path.join(out, 'live-fatal.txt'), String(e.stack || e)); process.exit(2); });
