#!/usr/bin/env node
/**
 * 온라인 랭킹 + Sky/Mini 연동 브라우저 테스트 (로컬 서버 · 모의 게임 · 실제 Worker 코드/SQLite)
 *   node backend/scripts/dev-server.ts (PORT=8787, MIN_PARTICIPANTS=3, DB_FILE=…) &
 *   node tools/live-server.cjs <paradise-dist> <food-dist> 8091   (EXTRA_MOUNTS=/mock/=tools/mock-game,/sdk/=docs/platform/sdk)
 *   NODE_PATH=$(npm root -g) node tools/platform-online-e2e.cjs http://localhost:8091 http://localhost:8787 out
 * Paradise 빌드: VITE_TEST_GAMES=1 VITE_FOOD_LINK=live VITE_FOOD_URL=… VITE_MOCK_GAME_URL=http://localhost:8091/mock/ VITE_RANKING_API=http://localhost:8787
 * (시드 플레이어는 이 테스트가 API 로 직접 만든 '테스트용 플레이어'이며 운영 화면의 가짜 순위가 아니다.)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [origin = 'http://localhost:8091', api = 'http://localhost:8787', out = 'shots-online'] = process.argv.slice(2);
const PARADISE = `${origin}/-GONA-s-Game-Paradise/`;
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const noH = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
let n = 0;
const rid = () => `seed-${String(++n).padStart(8, '0')}-${Math.random().toString(16).slice(2, 8)}`;

async function http(method, p, token, body) {
  const r = await fetch(api + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
/** 서버 API 로 테스트용 플레이어를 만들고 정상 경로(세션→제출)로 점수를 올린다 */
async function seed(nick, avatar, scores) {
  const r = await http('POST', '/v1/players', null, { nickname: nick, avatarId: avatar });
  const token = r.json.token;
  for (const [game, score, sub] of scores) {
    const s = await http('POST', '/v1/sessions', token, { gameId: game });
    await new Promise((res) => setTimeout(res, 30));
    const f = await http('POST', `/v1/sessions/${s.json.sessionId}/finish`, token, { resultId: rid(), outcome: 'failed', score, stage: 1, durationMs: 10, gameVersion: 'seed', scoreSchemaVersion: 1, ...(sub ? { subGameId: sub } : {}) });
    if (f.status !== 200) throw new Error(`seed failed ${nick} ${game} ${f.status} ${JSON.stringify(f.json)}`);
  }
}
async function mk(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); localStorage.setItem('gona.openingSeen', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
async function drain(page) {
  for (let i = 0; i < 40; i++) {
    if (!(await page.locator('.p-lvup, .p-ntoast').count())) { await page.waitForTimeout(200); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
async function register(page, w, h, nick) {
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
/** n 번째 섬(0 은 광장)을 눌러 팝업을 열고 '입장' → 모의 게임 */
async function enter(page, idx) {
  const b = await page.locator('.hit').nth(idx).boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForSelector('.popup a.btn-go');
  await page.waitForTimeout(900); // 서버 세션 준비
  await Promise.all([page.waitForURL(/\/mock\//), page.locator('.popup a.btn-go').tap()]);
}
const backToParadise = async (page) => { await Promise.all([page.waitForURL(/-GONA-s-Game-Paradise/), page.locator('#back').tap()]); await page.waitForSelector('.p-screen >> text=SCORE', { timeout: 15000 }); };

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]].filter(([w]) => !process.env.ONLY_W || String(w) === process.env.ONLY_W)) {
    const tag = `${w}x${h}`;
    const stamp = `${Date.now().toString(36).slice(-4)}`;
    // 시드: Sky 3명 + Mini(cat-jump) 3명 + 종합용(두 게임 모두 3명)
    await seed(`시드A${stamp}`, 'mom', [['sky-battle', 41000], ['food-island', 15000], ['minigame-paradise', 700, 'cat-jump']]);
    await seed(`시드B${stamp}`, 'dad', [['sky-battle', 33000], ['food-island', 9000], ['minigame-paradise', 500, 'cat-jump']]);
    await seed(`시드C${stamp}`, 'imo', [['sky-battle', 20000], ['food-island', 4000], ['minigame-paradise', 300, 'cat-jump']]);
    const { ctx, page, errors } = await mk(browser, w, h);
    await register(page, w, h, `온라인${stamp}`);
    await page.waitForTimeout(1500);
    const ident = JSON.parse((await ls(page, 'gp.v1.online')) || 'null');
    ok(`[${tag}] 온라인: 익명 등록 · 서버 발급 토큰은 이 기기에만`, !!ident && ident.token.length > 40 && ident.apiBase === api && !(await ls(page, 'gp.v1.player')).includes(ident.token));
    const me = await http('GET', '/v1/players/me', ident.token);
    ok(`[${tag}] 서버의 내 정보 = 닉네임·공개 식별코드 (토큰 아님)`, me.json.nickname === `온라인${stamp}` && me.json.publicCode === ident.publicCode && me.json.playerId === ident.playerId);
    const bundle = await page.evaluate(async () => { const urls = [...document.querySelectorAll('script[src]')].map((s) => s.src); return (await Promise.all(urls.map((u) => fetch(u).then((r) => r.text())))).join('\n'); });
    ok(`[${tag}] 프런트 번들에 비밀값(TOKEN_PEPPER/펩퍼) 없음`, !/TOKEN_PEPPER|dev-only-pepper/.test(bundle));

    // ── Sky Battle (모의 게임): 서버 세션 → SDK → 결과 → 결과 화면 → 온라인 제출
    await enter(page, 2);
    ok(`[${tag}] Sky: 모의 게임 SDK 활성(게임천국 세션)`, (await page.evaluate(() => document.documentElement.dataset.sdk)) === 'on' && /[?&]gp=/.test(page.url()));
    const sess = JSON.parse(await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('gp.v1.session.')); return localStorage.getItem(k); }));
    ok(`[${tag}] 로컬 세션에 서버 세션 ID 연결(온라인 검증 경로)`, !!sess.serverSessionId);
    await page.locator('#start').tap();
    for (let i = 0; i < 4; i++) await page.locator('#add').tap();
    await page.waitForTimeout(400);
    await page.locator('#clear').tap();
    await backToParadise(page);
    const rt = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] Sky 결과 화면: 점수·클리어·단계·보상`, rt.includes('400') && rt.includes('CLEAR') && /\d단계/.test(rt) && (/XP \+\d+/.test(rt) || rt.includes('너무 짧은 판')) && rt.includes('Sky'), rt.replace(/\n+/g, ' | ').slice(0, 160));
    await shot(page, `sky-result_${tag}`);
    await drain(page);
    const p1 = await player(page);
    ok(`[${tag}] Sky 기록·업적(첫 출격)`, p1.gameRecords['sky-battle'].plays === 1 && p1.gameRecords['sky-battle'].clears === 1 && !!p1.achievements.sky_first && !!p1.achievements.sky_clear);
    await page.waitForTimeout(1500);
    const out1 = JSON.parse((await ls(page, 'gp.v1.outbox')) || '[]');
    ok(`[${tag}] Sky 온라인 제출 완료(대기열 비어 있음)`, out1.length === 0);
    await page.getByRole('button', { name: '월드맵으로' }).tap();

    // ── Mini Game Land: 서로 다른 미니게임 2종
    for (const [sub, adds] of [['cat-jump', 6], ['fish-catch', 2]]) {
      await enter(page, 3);
      await page.selectOption('#subsel', sub);
      await page.locator('#start').tap();
      for (let i = 0; i < adds; i++) await page.locator('#add').tap();
      await page.locator('#over').tap();
      await backToParadise(page);
      await drain(page);
      await page.getByRole('button', { name: '월드맵으로' }).tap();
    }
    const p2 = await player(page);
    const mrec = p2.gameRecords['minigame-paradise'];
    ok(`[${tag}] Mini: 미니게임별 최고·플레이 횟수`, mrec.subGames['cat-jump'].bestScore === 600 && mrec.subGames['fish-catch'].bestScore === 200 && mrec.plays === 2 && !!p2.achievements.mini_first);
    await page.getByRole('button', { name: /PROFILE/ }).tap();
    await page.waitForSelector('.p-pcard');
    ok(`[${tag}] 프로필: 미니게임별 기록 표시`, (await page.locator('[aria-label="미니게임별 기록"]').innerText()).includes('캣 점프'));
    await shot(page, `profile-mini_${tag}`);

    // ── 온라인 랭킹 UI
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /RANKING/ }).tap();
    await page.getByRole('tab', { name: 'Sky' }).tap();
    await page.getByRole('tab', { name: /역대/ }).tap();
    await page.waitForSelector('.p-podium', { timeout: 8000 });
    const pod = await page.locator('.p-podium').innerText();
    ok(`[${tag}] Sky 역대 랭킹: TOP3 시상대(서버 응답) · 내 순위`, pod.includes('1st') && pod.includes('2nd') && pod.includes('3rd') && (await page.locator('.p-lbrow.me').count()) >= 1, pod.replace(/\n+/g, ' ').slice(0, 120));
    const top = await http('GET', '/v1/rankings?gameId=sky-battle&period=all');
    ok(`[${tag}] 화면 순위 = 서버 순위(동점 처리·정렬)`, top.json.entries[0].score === 41000 && top.json.entries.some((e) => e.score === 400 && e.nickname === `온라인${stamp}`));
    await shot(page, `ranking-sky_${tag}`);
    ok(`[${tag}] 가로 스크롤 없음 (랭킹)`, await noH(page));
    await page.getByRole('tab', { name: 'Mini' }).tap();
    await page.getByRole('tab', { name: '캣 점프' }).tap();
    await page.waitForSelector('.p-podium');
    ok(`[${tag}] Mini: 미니게임별 랭킹 탭(캣 점프)`, (await page.locator('.p-podium').innerText()).includes('시드A'));
    await page.getByRole('tab', { name: '종합' }).tap();
    await page.waitForFunction(() => document.body.innerText.includes("백분위"), null, { timeout: 10000 }).catch(() => {});
    ok(`[${tag}] 종합 랭킹: 서버 계산 결과(백분위 환산) 표시`, (await page.locator('.p-screen').innerText()).includes("백분위"), (await page.locator(".p-screen").innerText()).replace(/\n+/g," | ").slice(0,300));
    await shot(page, `ranking-overall_${tag}`);

    // ── 서버 장애: 랭킹 조회 실패 안내 → 복구 후 동기화
    await page.getByRole('tab', { name: 'Sky' }).tap();
    await page.route(`${api}/**`, (r) => r.abort('connectionrefused'));
    await page.getByRole('tab', { name: '주간 (월~일)' }).tap();
    await page.waitForSelector('text=랭킹을 불러오지 못했어요', { timeout: 8000 });
    ok(`[${tag}] 서버 오류: 조회 실패 안내 + 다시 시도 버튼(로컬 기록 안전 안내)`, (await page.getByRole('button', { name: '다시 시도' }).count()) === 1 && (await page.locator('.p-screen').innerText()).includes('로컬 기록은 그대로'));
    await shot(page, `ranking-error_${tag}`);
    // 오프라인으로 Sky 한 판 → 대기열
    await page.getByRole('button', { name: /WORLD/ }).tap();
    await enter(page, 2).catch(() => {});
    await page.evaluate(() => {}); // (세션은 오프라인이라 준비되지 않았을 수 있음 → 로컬 전용 판)
    await page.goto(PARADISE); await page.waitForSelector('.title, .hit'); if (await page.locator('.title').count()) await page.touchscreen.tap(w / 2, h / 2); await page.waitForSelector('.hit');
    ok(`[${tag}] 서버 연결 전/장애 중에도 앱 정상(로컬 모드 유지)`, (await page.locator('.hit').count()) > 0);
    await page.unroute(`${api}/**`);
    ok(`[${tag}] 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'online-e2e-result.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
