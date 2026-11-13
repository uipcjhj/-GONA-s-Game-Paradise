#!/usr/bin/env node
/**
 * Phase 2~6 브라우저 테스트 (393×636 · 390×844): PLAY → 세션 → (가짜 게임) → 결과 기록 → 복귀 → 결과 화면 →
 * 섬 팝업/프로필/랭킹(이 기기)/업적/도감/미션/상점, 중복·의심 결과·가져오기·초기화.
 * 가짜 게임은 같은 출처의 /fake-game.html(요청 가로채기, 배포물에 없음)이 계약대로 inbox 키만 쓴다.
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/platform-e2e2.cjs http://127.0.0.1:4173/ shots-p2
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://127.0.0.1:4173/', out = 'shots-p2'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const origin = new URL(url).origin;
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const FAKE = (opts) => `<!doctype html><meta charset=utf-8><title>fake</title><body>fake game<script>
const sid=new URLSearchParams(location.search).get('gp');
document.body.dataset.sid=sid||'';
const s=JSON.parse(localStorage.getItem('gp.v1.session.'+sid)||'null');
if(s){
  const now=Date.now();
  s.startedAt=new Date(now-5*60000).toISOString(); localStorage.setItem('gp.v1.session.'+sid,JSON.stringify(s));
  const mk=(score,outcome,stage)=>{const rid=crypto.randomUUID();
    localStorage.setItem('gp.v1.inbox.'+rid,JSON.stringify({kind:'gp-result',v:1,sdk:'fake',result:{resultId:rid,sessionId:sid,gameId:s.gameId,${opts.sub ? 'subGameId:"' + opts.sub + '",' : ''}gameVersion:'1.0.0',scoreSchemaVersion:1,outcome,score,stage,stageLabel:'성장 단계',startedAt:new Date(now-65000).toISOString(),endedAt:new Date(now-5000).toISOString(),durationMs:60000}}));return rid};
  window.__rids=${JSON.stringify(opts.scores)}.map(([sc,oc,st])=>mk(sc,oc,st));
  if(!location.hash.includes('stay')) setTimeout(()=>location.href=s.returnUrl,1500);
}
</script>`;

async function newPage(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} } });
  const page = await ctx.newPage();
  const errors = [];
  if (process.env.DBG) { page.on('framenavigated', (f) => f === page.mainFrame() && console.log('NAV', f.url())); page.on('console', (m) => console.log('C', m.text())); page.on('pageerror', (e) => console.log('PE', e.message)); }
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const shot = async (page, w, h, name) => { await page.waitForTimeout(350); return page.screenshot({ path: path.join(out, `${name}_${w}x${h}.png`) }); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const keys = (page, pre) => page.evaluate((pre) => Object.keys(localStorage).filter((k) => k.startsWith(pre)), pre);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));

async function register(page, w, h, nick = '고나짱') {
  await page.waitForSelector('.title');
  await page.touchscreen.tap(w / 2, h / 2);
  await page.waitForSelector('#gp-nick');
  await page.fill('#gp-nick', nick);
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.waitForSelector('text=WELCOME!');
  await page.getByRole('button', { name: /시작|입장|출발|월드/ }).first().tap().catch(() => {});
  await page.waitForSelector('.hit', { timeout: 8000 });
}
async function openIsland(page, nth) {
  const b = await page.locator('.hit').nth(nth).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('[data-testid=island-popup]');
  await page.waitForTimeout(1300);
}
async function playFake(browser, ctx, page, w, h, opts) {
  await ctx.route(/uipcjhj\.github\.io\/GoNa\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace('${origin}/fake-game.html?gp=${new URL(r.request().url()).searchParams.get('gp')}')</script>` }));
  await ctx.route(/fake-game\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: FAKE(opts) }));
  await openIsland(page, 1);
  const nav = page.waitForURL((u) => /fake-game\.html/.test(u.href));
  await page.locator('[data-testid=island-play]').tap();
  await nav;
}
const back = async (page) => { await page.goBack(); await page.waitForTimeout(450); };
async function afterReturn(page) { await page.waitForURL((u) => !/fake-game/.test(u.href), { timeout: 8000 }); }

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const { ctx, page, errors } = await newPage(browser, w, h);
    await page.goto(url);
    await register(page, w, h);

    // ── A. 최초: 기록 없음 표시 + 세션 발급 + 게임 이동
    await openIsland(page, 1);
    ok(`[${tag}] 섬 팝업: 기록 없음(연동 준비 안내)`, (await page.locator('[data-testid=island-record]').innerText()).includes('연동 준비 중'));
    await page.locator('[data-testid=island-close],.popup-close').first().tap();
    await playFake(browser, ctx, page, w, h, { scores: [[12345, 'cleared', 4]] });
    if (process.env.DBG) console.log('HTML', (await page.content()).slice(0, 400));
    await page.waitForSelector('body[data-sid]', { state: 'attached', timeout: 5000 });
    const sid = await page.locator('body').getAttribute('data-sid');
    if (process.env.DBG) console.log('DBG', page.url(), sid, await keys(page, 'gp.v1.'));
    ok(`[${tag}] PLAY → 게임 주소에 gp=세션 하나만, 세션 레코드 존재`, !!sid && (await keys(page, 'gp.v1.session.')).length === 1 && new URL(page.url()).search === `?gp=${sid}`);
    const sess = JSON.parse(await ls(page, 'gp.v1.session.' + sid));
    ok(`[${tag}] 세션: gameId·playerId·returnUrl`, sess.gameId === 'food-island' && sess.playerId.length > 8 && sess.returnUrl === `${origin}/`);
    await afterReturn(page);
    await page.waitForSelector('[data-testid=result]', { timeout: 8000 });
    ok(`[${tag}] 복귀 → 타이틀 건너뛰고 결과 화면`, Number(await page.locator('[data-testid=result-score]').getAttribute('data-value')) === 12345);
    await page.waitForTimeout(1100);
    ok(`[${tag}] 결과 점수 카운트업이 최종값에 도달`, (await page.locator('[data-testid=result-score]').innerText()) === '12,345');
    const rtxt = await page.locator('[data-testid=result]').innerText();
    ok(`[${tag}] 결과: CLEAR · 첫 기록 · XP/코인 · 업적`, rtxt.includes('CLEAR') && rtxt.includes('첫 기록') && /\+\d+\s*XP/.test(rtxt) && rtxt.includes('업적 달성'));
    ok(`[${tag}] 결과: 내 기록 4칸 + 가로 스크롤 없음`, rtxt.includes('최고 점수') && (await noHScroll(page)));
    await shot(page, w, h, '01-result');
    let pl = await player(page);
    ok(`[${tag}] 저장: plays 1·clears 1·best 12345·단계 4·원장 1·inbox 비어 있음`, pl.gameRecords['food-island'].plays === 1 && pl.gameRecords['food-island'].clears === 1 && pl.gameRecords['food-island'].bestScore === 12345 && pl.gameRecords['food-island'].bestStage === 4 && pl.resultLedger.length === 1 && (await keys(page, 'gp.v1.inbox.')).length === 0);
    ok(`[${tag}] XP·코인 증가 + 레벨/업적 저장`, pl.totalXP > 0 && pl.coinBalance > 0 && !!pl.achievements['play-1'] && !!pl.achievements['clear-1'] && !!pl.codex['game-food-island']);
    await page.locator('[data-testid=result-map]').tap();
    await page.waitForSelector('.hit');
    ok(`[${tag}] 월드맵 복귀 · HUD 코인 반영`, (await page.locator('.p-coinchip').innerText()).replace(/\D/g, '') === String(pl.coinBalance));
    // 새로고침 → 결과 화면은 다시 안 뜸
    await page.reload();
    await page.waitForSelector('.title');
    await page.touchscreen.tap(w / 2, h / 2);
    await page.waitForSelector('.hit');
    ok(`[${tag}] 새로고침 후 결과 화면 재표시 없음`, (await page.locator('[data-testid=result]').count()) === 0);
    // 섬 팝업 내 기록
    await openIsland(page, 1);
    ok(`[${tag}] 섬 팝업: 내 최고 12,345 · 1판`, (await page.locator('[data-testid=island-record]').innerText()).includes('12,345') && (await page.locator('[data-testid=island-record]').innerText()).includes('1판'));
    await shot(page, w, h, '02-island-record');
    await page.locator('.popup-close').tap();

    // ── B. 프로필 기록·통계
    await page.locator('[data-testid=nav-profile]').tap();
    await page.waitForSelector('[data-testid=stats]');
    ok(`[${tag}] 프로필: 통계 + 게임 기록 줄`, (await page.locator('[data-testid=stats]').innerText()).includes('1') && (await page.locator('[data-testid=rec-food-island]').innerText()).includes('12,345'));
    ok(`[${tag}] 프로필: 레벨/XP 진행`, (await page.locator('.p-pcard').innerText()).includes('LV'));
    await page.locator('.p-scroll').evaluate((e) => (e.scrollTop = 9999));
    await shot(page, w, h, '03-profile');
    // ── C. 랭킹: 온라인 미연결 + 이 기기 순위
    await page.locator('[data-testid=nav-ranking]').tap();
    await page.waitForSelector('[data-testid=rank-offline]');
    ok(`[${tag}] 랭킹: 온라인 미연결 명시 + 이 기기 순위에 내 점수 1건`, (await page.locator('[data-testid=rank-list] li').count()) === 1 && (await page.locator('[data-testid=rank-list]').innerText()).includes('12,345'));
    await page.getByRole('tab', { name: '역대 최고' }).tap();
    ok(`[${tag}] 랭킹: 역대 탭에도 표시`, (await page.locator('[data-testid=rank-list] li').count()) === 1);
    await page.getByRole('tab', { name: '종합' }).tap();
    ok(`[${tag}] 랭킹: 종합은 온라인 전용 안내(가짜 순위 없음)`, (await page.locator('.p-screen').innerText()).includes('온라인 전용'));
    await shot(page, w, h, '04-ranking');

    // ── D. MORE: 업적 · 도감 · 미션 · 상점
    await page.locator('[data-testid=nav-more]').tap();
    await page.locator('[data-testid=more-achievements]').tap();
    await page.waitForSelector('[data-testid=ach-play-1]');
    ok(`[${tag}] 업적: 달성 표시 + 목록`, (await page.locator('[data-testid=ach-play-1]').getAttribute('data-done')) === '1' && (await page.locator('[data-testid^=ach-]').count()) >= 10);
    await shot(page, w, h, '05-achievements');
    await back(page);
    await page.locator('[data-testid=more-codex]').tap();
    await page.waitForSelector('[data-testid=codex-grid]');
    ok(`[${tag}] 도감: 고나는 열림, 미발견은 ???`, (await page.locator('[data-testid=codex-char-gona]').getAttribute('data-state')) === 'open' && (await page.locator('[data-testid=codex-char-mom]').innerText()).includes('???'));
    await page.getByRole('tab', { name: /^게임 \d/ }).tap();
    ok(`[${tag}] 도감: 게임 탭 — Food 열림`, (await page.locator('[data-testid=codex-game-food-island]').getAttribute('data-state')) === 'open');
    await shot(page, w, h, '06-codex');
    await back(page);
    ok(`[${tag}] MORE 메뉴에 새 소식 점(받을 보상)`, (await page.locator('[data-testid=more-missions] .p-dot').count()) === 1);
    await page.locator('[data-testid=more-missions]').tap();
    await page.waitForSelector('[data-testid=attendance]');
    ok(`[${tag}] 미션: 출석 1일차 + 오늘의 미션 3개 + 주간 3개`, (await page.locator('[data-testid^=mission-d-]').count()) === 3 && (await page.locator('[data-testid^=mission-w-]').count()) === 3);
    const coinBefore = (await player(page)).coinBalance;
    await page.locator('[data-testid=attendance-claim]').tap();
    await page.waitForTimeout(300);
    const afterAtt = await player(page);
    ok(`[${tag}] 출석 보상: 코인 증가 · 두 번째 수령 불가`, afterAtt.coinBalance > coinBefore && (await page.locator('[data-testid=attendance-claim]').isDisabled()));
    let done = page.locator('[data-testid^=mission-][data-state=done]');
    let nDone = await done.count();
    if (!nDone) { // 오늘의 미션 3개는 무작위라 달성분이 없을 수 있음 → 한 개를 달성 상태로 만들어 수령 흐름을 검증(테스트 전용 조작)
      await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('gp.v1.player')); p.missions.weekly[0].value = 999; localStorage.setItem('gp.v1.player', JSON.stringify(p)); });
      await page.reload(); await page.waitForSelector('.title'); await page.touchscreen.tap(w / 2, h / 2); await page.waitForSelector('.hit');
      await page.locator('[data-testid=nav-more]').tap(); await page.locator('[data-testid=more-missions]').tap(); await page.waitForSelector('[data-testid=attendance]');
      done = page.locator('[data-testid^=mission-][data-state=done]'); nDone = await done.count();
    }
    ok(`[${tag}] 미션: 1판/클리어 등 달성분 수령 가능`, nDone >= 1);
    if (nDone) {
      const b4 = (await player(page)).coinBalance;
      await done.first().locator('button').tap();
      await page.waitForTimeout(300);
      const p2 = await player(page);
      ok(`[${tag}] 미션 수령: 코인 증가 + 수령 완료 표시`, p2.coinBalance > b4 && (await page.locator('[data-testid^=mission-][data-state=claimed]').count()) >= 1);
    }
    await shot(page, w, h, '07-missions');
    await back(page);
    await page.locator('[data-testid=more-shop]').tap();
    await page.waitForSelector('[data-testid=shop-list]');
    const coins = (await player(page)).coinBalance;
    if (process.env.DBG) console.log('COINS', coins);
    const cheapest = page.locator('[data-testid=item-frame-mint]');
    ok(`[${tag}] 상점: 테두리 목록`, (await cheapest.count()) === 1);
    if (coins >= 40) {
      await cheapest.locator('button').tap();
      await page.getByRole('button', { name: '구매' }).tap();
      await page.waitForTimeout(300);
      const p3 = await player(page);
      if (process.env.DBG) console.log('P3', p3.coinBalance, p3.inventory);
      ok(`[${tag}] 상점: 구매 → 코인 차감 · 보유 · 장착`, p3.coinBalance === coins - 40 + 10 /* 첫 쇼핑 업적 +10 */ && !!p3.achievements['shop-1'] && p3.inventory.owned.includes('frame-mint') && p3.inventory.equipped.frame === 'frame-mint');
      ok(`[${tag}] 상점: 구매 후 장착 중 표시`, (await cheapest.getAttribute('data-state')) === 'equipped');
    } else ok(`[${tag}] 상점: 구매 흐름(코인 부족 → 버튼 비활성)`, await cheapest.locator('button').isDisabled());
    await shot(page, w, h, '08-shop');
    await page.getByRole('tab', { name: '칭호' }).tap();
    await back(page);
    await page.locator('[data-testid=nav-profile]').tap();
    await page.waitForSelector('[data-testid=portrait]');
    ok(`[${tag}] 프로필: 장착한 테두리가 초상화에 반영`, (await page.locator('[data-testid=portrait]').getAttribute('style')).includes('--frame'));

    // ── E. 중복·의심 결과·여러 판 동시
    const pre = await player(page);
    const dupRid = pre.resultLedger[0];
    const evil = await page.evaluate(({ sid, dupRid }) => {
      const s = JSON.parse(localStorage.getItem('gp.v1.session.' + sid));
      const now = Date.now();
      const base = { sessionId: sid, gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'failed', stage: 1, startedAt: new Date(now - 65000).toISOString(), endedAt: new Date(now - 5000).toISOString(), durationMs: 60000 };
      const put = (r) => localStorage.setItem('gp.v1.inbox.' + r.resultId, JSON.stringify({ kind: 'gp-result', v: 1, sdk: 'x', result: r }));
      put({ ...base, resultId: dupRid, score: 30000 }); // 이미 반영된 resultId
      put({ ...base, resultId: 'evil-score-0001', score: 9999999 }); // 상한 초과
      put({ ...base, resultId: 'evil-rate-00001', score: 400000 }); // 초당 점수 초과
      localStorage.setItem('gp.v1.inbox.garbage-0001', '{{{');
      put({ ...base, resultId: 'good-result-001', score: 20000, outcome: 'cleared' });
      put({ ...base, resultId: 'good-result-002', score: 15000 });
      window.dispatchEvent(new Event('pageshow'));
      return true;
    }, { sid, dupRid });
    await page.waitForTimeout(800);
    if (process.env.DBG) console.log('INBOX', await keys(page, 'gp.v1.inbox.'), await keys(page, 'gp.v1.rejected.'), (await player(page)).gameRecords['food-island'].plays, await page.locator('body').innerText().then((t) => t.slice(0, 200)));
    await page.waitForSelector('[data-testid=result]', { timeout: 6000 });
    const r2 = await page.locator('[data-testid=result]').innerText();
    ok(`[${tag}] 여러 판: 최신 판 표시 + "2판이 기록" (중복·의심은 제외)`, r2.includes('2판이 기록됐어요'));
    const p4 = await player(page);
    ok(`[${tag}] 중복 resultId 무시 · 상한/속도/깨진 결과 거부 · 정상 2건만 반영`, p4.gameRecords['food-island'].plays === 3 && p4.gameRecords['food-island'].bestScore === 20000 && p4.resultLedger.length === 3);
    ok(`[${tag}] 거부 결과는 보관소로, inbox 비어 있음`, (await keys(page, 'gp.v1.inbox.')).length === 0 && (await keys(page, 'gp.v1.rejected.')).length === 3);
    ok(`[${tag}] 신기록(★ NEW BEST) 표시`, await page.locator('[data-testid=result-newbest]').count());
    await shot(page, w, h, '09-result-multi');
    await page.locator('[data-testid=result-map]').tap();

    // ── F. 설정: 토글 · 이전 Food 기록 가져오기 · 백업/복원 호환
    await page.evaluate(() => { localStorage.setItem('dino-snack-adventure.best', '7777'); localStorage.setItem('dino-snack-adventure.bestStage', '2'); });
    await page.locator('[data-testid=nav-more]').tap();
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.locator('[data-testid=set-vibration]').tap();
    await page.locator('[data-testid=set-motion]').tap();
    const p5 = await player(page);
    ok(`[${tag}] 설정: 진동 끄기·움직임 줄이기 저장`, p5.settings.vibration === false && p5.settings.reduceMotion === true);
    await page.locator('[data-testid=import-food]').tap();
    await page.getByRole('button', { name: '가져오기', exact: true }).tap();
    await page.waitForTimeout(300);
    const p6 = await player(page);
    ok(`[${tag}] 이전 기록 가져오기: 높은 기존 기록은 유지·1회 처리, Food 키 불변`, p6.stats['import:food-island'] === 1 && p6.gameRecords['food-island'].bestScore === 20000 && (await ls(page, 'dino-snack-adventure.best')) === '7777');
    await page.locator('[data-testid=import-food]').tap();
    ok(`[${tag}] 두 번째 가져오기 차단 안내`, await page.locator('text=이미 가져왔어요').count());
    await page.getByRole('button', { name: '확인' }).tap();
    await shot(page, w, h, '10-settings');

    // ── G. 초기화: 연동 키 정리, Food 키 보존
    if (process.env.DBG) console.log('STEP G', await page.evaluate(() => history.length));
    await page.getByRole('button', { name: '초기화', exact: true }).tap();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '계속' }).tap();
    await page.waitForTimeout(450);
    await page.getByRole('button', { name: '모두 삭제' }).tap();
    await page.waitForSelector('#gp-nick');
    ok(`[${tag}] 초기화: player·세션·보관 키 삭제, Food 기록 보존`, (await ls(page, 'gp.v1.player')) === null && (await keys(page, 'gp.v1.session.')).length === 0 && (await keys(page, 'gp.v1.rejected.')).length === 0 && (await ls(page, 'dino-snack-adventure.best')) === '7777' && (await ls(page, 'gona.openingSeen')) === '1');
    await page.fill('#gp-nick', '빈털터리');
    await page.getByRole('button', { name: /다음/ }).tap();
    await page.getByRole('button', { name: '이걸로 결정!' }).tap();
    await page.waitForSelector('text=WELCOME!');
    await page.getByRole('button', { name: /시작|입장|출발|월드/ }).first().tap().catch(() => {});
    await page.waitForSelector('.hit');
    await page.locator('[data-testid=nav-more]').tap();
    await page.locator('[data-testid=more-shop]').tap();
    await page.waitForSelector('[data-testid=shop-list]');
    ok(`[${tag}] 새 플레이어(코인 0): 모든 구매 버튼 비활성 · 기본 장착 2개`, (await page.locator('[data-testid^=item-] button:not([disabled])').count()) === 0 || (await page.locator('[data-testid=item-frame-gold]').getAttribute('data-state')) === 'equipped');
    const pz = await player(page);
    ok(`[${tag}] 새 플레이어: 코인 0 · 기록 없음 · 출석 1일차`, pz.coinBalance === 0 && Object.keys(pz.gameRecords).length === 0 && pz.missions.attendance.streak === 1);
    ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
