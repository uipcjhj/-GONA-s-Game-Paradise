#!/usr/bin/env node
/**
 * Food 보스전 재도전 실연동 검증 (개발 빌드 전용 · 운영 빌드에는 테스트 진입이 없음)
 *   보스전 진입: Food 의 기존 개발용 진입 ?test=sniff-boss (__DEV_TOOLS__ 게이트 — 정식 빌드에서는 코드째 제거됨). Food 소스·난이도·보스 행동은 수정하지 않는다.
 *   흐름: 보스전에서 입력 없이 사망(실제 피격) → '보스전 다시'(실제 터치) → 보스 격파(개발 훅으로 마지막 일격만 보조) → 엔딩 → 클리어 결과
 *   NODE_PATH=$(npm root -g) node tools/live-boss-e2e.cjs http://localhost:8090 shots-boss
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { makeInput } = require('./food-bot.cjs');
const [origin = 'http://localhost:8090', out = 'shots-boss'] = process.argv.slice(2);
const PARADISE = `${origin}/-GONA-s-Game-Paradise/`;
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const keys = (page, p) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p)), p);
const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
const shot = async (page, n) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${n}.png`) }); };
async function drain(page) {
  for (let i = 0; i < 30; i++) {
    if (!(await page.locator('.p-lvup, .p-ntoast').count())) { await page.waitForTimeout(200); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
(async () => {
  const browser = await chromium.launch();
  const [w, h] = [393, 636];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|navigator\.vibrate/.test(m.text()) && errors.push(m.text()));
  // 게임천국 등록 → Food 섬 입장(세션 발급)
  await page.goto(PARADISE);
  await page.waitForSelector('.title');
  await page.touchscreen.tap(w / 2, h / 2);
  await page.fill('#gp-nick', '보스재도전');
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('radio', { name: '고나' }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.getByRole('button', { name: /게임천국 입장/ }).tap();
  await page.waitForSelector('.hit');
  await drain(page);
  const b = await page.locator('.hit').nth(1).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.popup a.btn-go');
  await Promise.all([page.waitForURL(/\/GoNa\//), page.locator('.popup a.btn-go').tap()]);
  const gpUrl = page.url();
  ok('Food 가 ?gp=<세션> 으로 열림', /[?&]gp=[\w-]{8,}/.test(gpUrl));
  const inboxOf = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.inbox.')).map((k) => JSON.parse(localStorage.getItem(k)).result).sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt)));
  const enterBoss = async (id) => {
    await page.goto(gpUrl + '&test=' + id);
    const input = await makeInput(ctx, page);
    await page.waitForFunction(() => { const g = window.__gona; const sc = g && g.scene.getScene('Game'); return sc && sc.battle && sc.state === 'playing'; }, null, { timeout: 60000 });
    // 보스 진입 시점 점수 500 (Food 는 재도전 때 '보스 진입 시점' 점수로 시작한다) — 사망 점수와 구분하기 위한 테스트 설정
    await page.evaluate(() => { const sc = window.__gona.scene.getScene('Game'); sc.score = 500; sc.retryCarry = { score: 500, snacks: 0 }; });
    const info = await page.evaluate(() => { const b = window.__gona.scene.getScene('Game').battle; return { id: b.id, hp: b.hp }; });
    return { input, info };
  };
  const dieNow = async () => {
    await page.waitForSelector('.over-screen', { state: 'visible', timeout: 240000 });
    await page.waitForTimeout(800);
    return page.evaluate(() => ({ boss: !!document.querySelector('.boss-retry:not(.hidden)'), cp: !!document.querySelector('.cp-retry:not(.hidden)'), btn: (document.querySelector('.boss-retry:not(.hidden)') || document.querySelector('.cp-retry:not(.hidden)') || {}).textContent, txt: document.querySelector('.over-screen')?.innerText.replace(/\n+/g, ' | ').slice(0, 170) }));
  };
  const playing = () => page.waitForFunction(() => { const sc = window.__gona.scene.getScene('Game'); return sc.state === 'playing' && sc.battle; }, null, { timeout: 15000 });

  // ── ① 뽀뽀괴물전: 사망 → '뽀뽀괴물전 다시'(boss-retry) → 이월 점수로 같은 보스 재시작 → 다시 사망 ──
  let { input, info: kiss0 } = await enterBoss('kiss-boss');
  ok('① 뽀뽀괴물 보스전 진입(실제 보스전)', kiss0.id === 'kiss', JSON.stringify(kiss0));
  const o1 = await dieNow();
  ok('① 보스전 사망 → "뽀뽀괴물전 다시" 버튼', o1.boss, o1.btn + ' / ' + o1.txt);
  const sK1 = num((o1.txt.match(/([\d,]+)점/) || [])[1]);
  await shot(page, 'kiss-over');
  let ib = await inboxOf();
  ok('① 사망 1건 전달(failed · extra.bossRetry=kiss)', ib.length === 1 && ib[0].outcome === 'failed' && ib[0].extra?.bossRetry === 'kiss', JSON.stringify(ib.map((r) => ({ o: r.outcome, s: r.score, x: r.extra }))));
  await input.tap('.boss-retry');
  await playing();
  const carried1 = await page.evaluate(() => window.__gona.scene.getScene('Game').score);
  ok('① 보스전 다시: 보스 진입 시점 점수(500)로 시작 — 사망 점수를 이어받지 않음(이중 계산 없음)', carried1 === 500 && sK1 >= 500, `사망 ${sK1} → 재시작 ${carried1}`);
  const kiss1 = await page.evaluate(() => { const b = window.__gona.scene.getScene('Game').battle; return { id: b.id, hp: b.hp }; });
  ok('① 같은 보스·같은 체력으로 재시작(난이도 불변)', kiss1.id === kiss0.id && kiss1.hp === kiss0.hp, JSON.stringify({ kiss0, kiss1 }));
  const o1b = await dieNow();
  ib = await inboxOf();
  ok('① 재도전 판 사망도 판마다 결과 1건(총 2건, resultId 서로 다름)', ib.length === 2 && ib[0].resultId !== ib[1].resultId && ib.every((r) => r.outcome === 'failed'), String(ib.length));

  // ── ② 킁카괴물(최종 보스)전: 사망 → 같은 위치 체크포인트 '이어하기' → 이월 → 보스 격파 → 클리어 ──
  ({ input } = await enterBoss('sniff-boss'));
  ok('② 킁카괴물 최종 보스전 진입', true);
  const o2 = await dieNow();
  ok('② 최종 보스 사망 → "이어하기 · 최종 보스부터"(Food 규칙: 같은 곳이라 하나만 표시)', o2.cp && !o2.boss, o2.btn + ' / ' + o2.txt);
  const sS1 = num((o2.txt.match(/([\d,]+)점/) || [])[1]);
  await shot(page, 'sniff-over');
  ib = await inboxOf();
  ok('② 사망 1건 추가(총 3건 · failed · extra.bossRetry=sniff)', ib.length === 3 && ib[2].outcome === 'failed' && ib[2].extra?.bossRetry === 'sniff', JSON.stringify(ib.map((r) => r.outcome)));
  await input.tap('.cp-retry');
  await playing();
  const carried2 = await page.evaluate(() => window.__gona.scene.getScene('Game').score);
  // 체크포인트는 보스 진입 순간(테스트 진입 점수 0)에 저장되므로 그 점수로 복원된다 — 사망 점수는 이어받지 않는다
  ok('② 이어하기: 체크포인트 저장 시점 점수(진입 시 0)로 시작 — 사망 점수를 이어받지 않음', carried2 === 0 && sS1 > carried2, `사망 ${sS1} → 재시작 ${carried2}`);
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const b = window.__gona.scene.getScene('Game').battle; b.awakened = true; b.rage = 3; b.specialsDone = 3; b.hp = 1; b.damage(5); });
  await page.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.inbox.')).length >= 4, null, { timeout: 120000 });
  ib = await inboxOf();
  ok('② 보스 격파 → 클리어 결과 1건 추가(총 4건: failed×3 → cleared)', ib.length === 4 && ib[3].outcome === 'cleared' && ib.slice(0, 3).every((r) => r.outcome === 'failed'), JSON.stringify(ib.map((r) => ({ o: r.outcome, s: r.score }))));
  ok('② 클리어 점수 ≥ 재시작 점수', ib[3].score >= carried2, `${carried2} → ${ib[3].score}`);
  ok('resultId 4건 모두 다름', new Set(ib.map((r) => r.resultId)).size === 4);
  await page.waitForTimeout(2000);
  ok('엔딩 진행 중 결과 추가 전달 없음(4건 유지)', (await keys(page, 'gp.v1.inbox.')).length === 4);
  // 게임천국으로 이동 → 소비
  await page.goto(PARADISE);
  await page.waitForSelector('text=ADVENTURE CLEAR', { timeout: 20000 }).catch(() => {});
  const rt = await page.locator('.p-screen').first().innerText().catch(() => '');
  ok('결과 화면(게임천국): ADVENTURE CLEAR', rt.includes('CLEAR'), rt.replace(/\n+/g, ' | ').slice(0, 140));
  await shot(page, 'boss-clear-result');
  await drain(page);
  const p1 = await player(page);
  const rec = p1.gameRecords['food-island'];
  ok('기록: 플레이 4(=판 수) · 클리어 1', rec && rec.plays === 4 && rec.clears === 1, JSON.stringify({ plays: rec?.plays, clears: rec?.clears, best: rec?.bestScore }));
  ok('원장(중복 방지) 4건 · inbox 비움', p1.resultLedger.length === 4 && (await keys(page, 'gp.v1.inbox.')).length === 0, String(p1.resultLedger.length));
  ok('XP·코인 일관(합계 = 누적 지급, 이중 지급 없음)', p1.totalXP === p1.stats.totalXpEarned && p1.coinBalance === p1.stats.totalCoinsEarned, `XP ${p1.totalXP} 코인 ${p1.coinBalance}`);
  const xp0 = p1.totalXP, coin0 = p1.coinBalance;
  await page.reload();
  await page.waitForSelector('.title, .hit');
  const p2 = await player(page);
  ok('새로고침 후 XP·코인·기록 그대로(재지급 없음)', p2.totalXP === xp0 && p2.coinBalance === coin0 && p2.gameRecords['food-island'].plays === 4);
  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'live-boss-result.json'), JSON.stringify({ results }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
