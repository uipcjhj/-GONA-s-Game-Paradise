#!/usr/bin/env node
/**
 * 전체 기능 브라우저 테스트 + 스크린샷 (393×636 · 390×844)
 *   npm run build && npx vite preview --port 4173 &
 *   NODE_PATH=$(npm root -g) node tools/platform-e2e-full.cjs http://localhost:4173/ shots-full
 * 게임 결과는 실제 Food 패치가 쓰게 될 것과 똑같은 방식(gp.v1.session / gp.v1.inbox 키)으로 주입한다.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [url = 'http://localhost:4173/', out = 'shots-full'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => { results.push([name, !!cond, extra]); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const player = async (page) => JSON.parse(await ls(page, 'gp.v1.player'));
const noH = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);

async function mkPage(browser, w, h, ctxIn) {
  const ctx = ctxIn || (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true }));
  if (!ctxIn) await ctx.addInitScript(() => { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return { ctx, page, errors };
}
const shot = async (page, w, h, name) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `${name}_${w}x${h}.png`) }); };
const tapTitle = async (page, w, h) => { await page.waitForSelector('.title'); await page.touchscreen.tap(w / 2, h / 2); };
const uid = () => 'x' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);

async function register(page, w, h, nick = '고나짱') {
  await tapTitle(page, w, h);
  await page.fill('#gp-nick', nick);
  await page.getByRole('button', { name: /다음/ }).tap();
  await page.getByRole('radio', { name: '엄마' }).tap();
  await page.getByRole('button', { name: '이걸로 결정!' }).tap();
  await page.getByRole('button', { name: /게임천국 입장/ }).tap();
  await page.waitForSelector('.hit');
  await drain(page);
}
/** 알림 토스트/레벨업 연출을 눌러서 모두 닫음 */
async function drain(page) {
  for (let i = 0; i < 30; i++) {
    const el = page.locator('.p-lvup, .p-ntoast').first();
    if (!(await el.count())) { await page.waitForTimeout(150); if (!(await page.locator('.p-lvup, .p-ntoast').count())) return; }
    await page.locator('.p-lvup, .p-ntoast').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(80);
  }
}
/** 게임이 쓸 결과를 실제와 같은 방식으로 저장소에 넣고(세션 + inbox), 앱이 돌아온 것처럼 깨운다 */
async function inject(page, o = {}) {
  const r = await page.evaluate((o) => {
    const p = JSON.parse(localStorage.getItem('gp.v1.player'));
    const now = Date.now();
    const rnd = () => Math.random().toString(16).slice(2, 10);
    const sid = o.sessionId || ('sess-' + rnd() + rnd());
    if (!o.sessionId && !o.noSession) localStorage.setItem('gp.v1.session.' + sid, JSON.stringify({ version: 1, sessionId: sid, gameId: 'food-island', playerId: o.playerId || p.playerId, startedAt: new Date(now - 900000).toISOString(), expiresAt: new Date(now + 43200000).toISOString(), returnUrl: location.href }));
    const dur = (o.dur ?? 120) * 1000;
    const rid = o.resultId || ('rid-' + rnd() + rnd());
    const env = { kind: 'gp-result', v: 1, sdk: 'e2e', result: { resultId: rid, sessionId: sid, gameId: o.gameId || 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: o.cleared ? 'cleared' : 'failed', score: o.score ?? 1000, stage: o.stage ?? 2, startedAt: new Date(now - dur - 1000).toISOString(), endedAt: new Date(now - 1000).toISOString(), durationMs: dur, extra: { snacks: Math.floor((o.score ?? 1000) / 40) } } };
    localStorage.setItem('gp.v1.inbox.' + rid, JSON.stringify(env));
    window.dispatchEvent(new Event('pageshow'));
    return { rid, sid };
  }, o);
  await page.waitForTimeout(500);
  return r;
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[393, 636], [390, 844]]) {
    const tag = `${w}x${h}`;
    const { ctx, page, errors } = await mkPage(browser, w, h);
    await page.route('https://uipcjhj.github.io/GoNa/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>food stub</body></html>' }));
    await page.goto(url);
    await register(page, w, h);
    const p0 = await player(page);
    ok(`[${tag}] v2 저장 구조 (기록·보상·상점 필드)`, p0.schemaVersion === 2 && p0.gameRecords && p0.stats && p0.inventory.equipped.frame === 'frame_basic' && p0.titleId === 'rookie' && p0.attendance.streak === 1);
    ok(`[${tag}] 첫 접속 출석 보상(코인 10·XP 10), 가짜 플레이 기록 없음`, p0.coinBalance === 10 && p0.totalXP === 10 && Object.keys(p0.gameRecords).length === 0 && p0.stats.totalPlayCount === 0);

    // ── 연동 전 상태 표시 (Food 패치 전)
    const b = await page.locator('.hit').nth(1).boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForSelector('.popup');
    ok(`[${tag}] 섬 팝업: 연동 전 상태 명시(가짜 기록 없음)`, (await page.locator('.popup-rec').innerText()).includes('연동 준비 중'));
    await shot(page, w, h, '01-island-pending');
    // PLAY: 세션 없이 기존 주소로, 실행 기록만
    const href = await page.locator('.popup a.btn-go').getAttribute('href');
    await Promise.all([page.waitForURL('https://uipcjhj.github.io/GoNa/'), page.locator('.popup a.btn-go').tap()]);
    ok(`[${tag}] PLAY: 기존 Food 주소 그대로(?gp 없음) · 같은 탭 이동`, href === 'https://uipcjhj.github.io/GoNa/' && page.url() === 'https://uipcjhj.github.io/GoNa/');
    await page.goBack();
    await page.waitForSelector('.title, .hit');
    if (await page.locator('.title').count()) await tapTitle(page, w, h);
    await page.waitForSelector('.hit');
    const p1 = await player(page);
    ok(`[${tag}] 실행 기록: launches=1 · '첫 모험 시작' 업적 · 세션 없음`, p1.stats.launches === 1 && !!p1.achievements.first_adventure && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.session.')))));
    await drain(page);

    // ── 결과 수신 → 결과 화면
    await inject(page, { score: 4200, stage: 2 });
    await page.waitForSelector('text=RESULT');
    const rtxt = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] 결과 화면: 점수·첫 기록·보상·단계`, rtxt.includes('4,200') && rtxt.includes('첫 기록') && /XP \+\d+/.test(rtxt) && rtxt.includes('2단계') && rtxt.includes('1회'));
    await shot(page, w, h, '02-result-first');
    ok(`[${tag}] 결과 화면 가로 스크롤 없음`, await noH(page));
    const p2 = await player(page);
    ok(`[${tag}] 기록 저장 · inbox 정리`, p2.gameRecords['food-island'].bestScore === 4200 && p2.gameRecords['food-island'].plays === 1 && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.inbox.')))));
    // 중복 / 새로고침
    const dupId = p2.resultLedger[0];
    await drain(page);
    await page.getByRole('button', { name: '월드맵으로' }).tap();
    await inject(page, { resultId: dupId, sessionId: undefined });
    const p3 = await player(page);
    ok(`[${tag}] 동일 resultId 재전송 → 중복 반영 없음`, p3.gameRecords['food-island'].plays === 1 && p3.coinBalance === p2.coinBalance && (await page.locator('text=RESULT').count()) === 0);
    await page.reload();
    await tapTitle(page, w, h);
    await page.waitForSelector('.hit');
    ok(`[${tag}] 새로고침 후에도 기록 1회·결과 화면 재표시 없음`, (await player(page)).gameRecords['food-island'].plays === 1 && (await page.locator('text=RESULT').count()) === 0);
    await drain(page);

    // ── 신기록 · 클리어 · 레벨업 · 업적 · 칭호 · 도감
    await inject(page, { score: 9100, stage: 3 });
    await page.waitForSelector('text=NEW BEST');
    ok(`[${tag}] 신기록 표시 + 이전 최고 대비`, (await page.locator('.p-score').innerText()).includes('4,200'));
    await shot(page, w, h, '03-result-newbest');
    await drain(page);
    await page.getByRole('button', { name: '월드맵으로' }).tap();
    await inject(page, { score: 21000, stage: 4, cleared: true, dur: 540 });
    await page.waitForSelector('text=ADVENTURE CLEAR');
    await page.waitForSelector('.p-lvup, .p-ntoast', { timeout: 4000 }).catch(() => {});
    ok(`[${tag}] 클리어 결과 + 레벨업/업적 알림`, (await page.locator('.p-lvup').count()) + (await page.locator('.p-ntoast').count()) > 0);
    await shot(page, w, h, '04-levelup-or-toast');
    await drain(page);
    await shot(page, w, h, '05-result-clear');
    const p4 = await player(page);
    ok(`[${tag}] 업적: 첫 완료·첫 클리어·첫 신기록·성장3/4·점수5000`, ['first_complete', 'first_clear', 'first_best', 'food_stage_3', 'food_stage_4', 'food_score_5000'].every((k) => p4.achievements[k]), Object.keys(p4.achievements).join(','));
    ok(`[${tag}] 플레이 3회·클리어 1회·최고 21,000·단계 4`, p4.gameRecords['food-island'].plays === 3 && p4.gameRecords['food-island'].clears === 1 && p4.gameRecords['food-island'].bestScore === 21000 && p4.gameRecords['food-island'].bestStage === 4);
    ok(`[${tag}] XP/코인 지급 · 레벨업 · 일관성(코인=획득−지출)`, p4.playerLevel > 1 && p4.totalXP === p4.stats.totalXpEarned && p4.coinBalance === p4.stats.totalCoinsEarned - p4.inventory.history.reduce((a, x) => a + x.price, 0));
    await page.getByRole('button', { name: '월드맵으로' }).tap();

    // ── 프로필
    await page.getByRole('button', { name: /PROFILE/ }).tap();
    await page.waitForSelector('.p-pcard');
    await drain(page);
    const prof = await page.locator('.p-screen').first().innerText();
    ok(`[${tag}] 프로필: 게임 기록·누적·업적·칭호`, prof.includes('21,000') && prof.includes('3회') && /업적\s*\n?\s*\d+ \/ \d+/.test(prof.replace(/\n/g, ' ')) || (prof.includes('21,000') && prof.includes('누적 플레이')));
    await shot(page, w, h, '06-profile-full');
    ok(`[${tag}] 가로 스크롤 없음 (프로필)`, await noH(page));
    // 칭호: 미획득 선택 불가, 획득 장착
    await page.getByRole('button', { name: '칭호', exact: true }).tap();
    await page.waitForSelector('text=칭호 변경');
    const lockedBtn = page.locator('.p-modal button.p-item', { hasText: '전설의 모험가' });
    ok(`[${tag}] 미획득 칭호는 선택 불가(잠금)`, await lockedBtn.isDisabled());
    await shot(page, w, h, '07-title-modal');
    await page.locator('.p-modal button.p-item', { hasText: '모험을 끝낸 자' }).tap();
    await page.waitForTimeout(300);
    ok(`[${tag}] 획득 칭호 장착 → 프로필 반영`, (await player(page)).titleId === 't_cleared' && (await page.locator('.p-pcard').innerText()).includes('모험을 끝낸 자'));
    // 대표 업적
    await page.getByRole('button', { name: '변경', exact: true }).first().tap();
    await page.locator('.p-modal button.p-item', { hasText: '첫 클리어' }).tap();
    await page.waitForTimeout(300);
    ok(`[${tag}] 대표 업적 지정`, (await player(page)).pinnedAchievement === 'first_clear');

    // ── MORE → 업적 / 도감 / 미션 / 출석 / 상점
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.waitForSelector('.p-menu');
    ok(`[${tag}] MORE: 6개 메뉴`, (await page.locator('.p-menu button').count()) === 6);
    await shot(page, w, h, '08-more');
    await page.getByRole('button', { name: /업적/ }).tap();
    await page.waitForSelector('text=업적 ACHIEVEMENTS');
    await shot(page, w, h, '09-achievements');
    ok(`[${tag}] 업적 화면: 달성/미달성 구분·진행률`, (await page.locator('.p-item:not(.lock)').count()) >= 6 && (await page.locator('.p-item.lock').count()) >= 3);
    ok(`[${tag}] 가로 스크롤 없음 (업적)`, await noH(page));
    await page.goBack(); await page.waitForSelector('.p-menu');
    await page.getByRole('button', { name: /도감/ }).tap();
    await page.waitForSelector('text=도감 CODEX');
    const got = await page.locator('.p-cx:not(.lock)').count();
    ok(`[${tag}] 도감: 클리어 기록으로 가족 6+고나 발견`, got === 7, `${got}`);
    await page.locator('.p-cx:not(.lock)').nth(1).tap();
    ok(`[${tag}] 도감 카드: 설명·발견 조건·발견일`, (await page.locator('.p-panel').last().innerText()).includes('발견 조건'));
    await shot(page, w, h, '10-codex');
    await page.getByRole('tab', { name: /보스/ }).tap();
    await page.locator('.p-cx').first().tap();
    ok(`[${tag}] 이미지 없는 보스: 임의 이미지 없이 아이콘+설명`, (await page.locator('.p-cx img').count()) === 0);
    await shot(page, w, h, '11-codex-boss');
    await page.goBack(); await page.waitForSelector('.p-menu');
    await page.getByRole('button', { name: /미션/ }).tap();
    await page.waitForSelector('text=미션 MISSIONS');
    await shot(page, w, h, '12-missions');
    const before = (await player(page)).coinBalance;
    const claim = page.getByRole('button', { name: '받기' });
    const n = await claim.count();
    ok(`[${tag}] 미션: 완료한 미션만 '받기' 활성(실행·결과 기반)`, n >= 2, `${n}`);
    await claim.first().tap();
    await page.waitForTimeout(300);
    const after = await player(page);
    ok(`[${tag}] 미션 보상 수령 · 코인 증가 · 수령완료`, after.coinBalance > before && (await page.locator('text=수령 완료').count()) >= 1 && after.stats.missionsCompleted === 1);
    const claimedId = Object.keys(after.daily.missions).find((k) => after.daily.missions[k].claimed);
    await page.evaluate((id) => window.dispatchEvent(new Event('pageshow')), claimedId);
    ok(`[${tag}] 같은 미션 중복 수령 불가`, (await player(page)).stats.missionsCompleted === 1);
    await drain(page);
    await page.goBack(); await page.waitForSelector('.p-menu');
    await page.getByRole('button', { name: /출석/ }).tap();
    await page.waitForSelector('text=출석 CHECK-IN');
    ok(`[${tag}] 출석: 연속 1일·오늘 완료`, (await page.locator('.p-screen').innerText()).includes('오늘 출석 완료'));
    await shot(page, w, h, '13-attendance');
    await page.goBack(); await page.waitForSelector('.p-menu');

    // ── 상점
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('gp.v1.player')); p.coinBalance = 700; p.stats.totalCoinsEarned = Math.max(p.stats.totalCoinsEarned, 700); localStorage.setItem('gp.v1.player', JSON.stringify(p)); });
    await page.reload(); await tapTitle(page, w, h); await page.waitForSelector('.hit'); await drain(page);
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.getByRole('button', { name: /상점/ }).tap();
    await page.waitForSelector('text=상점 SHOP');
    await shot(page, w, h, '14-shop');
    ok(`[${tag}] 상점: 비싼 아이템은 코인 부족 비활성`, await page.locator('.p-shop-item', { hasText: '무지개 테두리' }).getByRole('button').isDisabled());
    await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button').tap();
    await page.waitForSelector('text=잎사귀 테두리 구매');
    await shot(page, w, h, '15-shop-confirm');
    await page.getByRole('button', { name: '취소' }).tap();
    ok(`[${tag}] 구매 취소 → 코인 그대로`, (await player(page)).coinBalance === 700);
    await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button').tap();
    await page.getByRole('button', { name: '구매', exact: true }).tap();
    await page.waitForTimeout(400);
    const ps = await player(page);
    ok(`[${tag}] 구매: 코인 차감·보유·내역`, ps.coinBalance === ps.stats.totalCoinsEarned - 150 && ps.coinBalance < 700 && ps.coinBalance >= 550 && ps.inventory.owned.includes('frame_leaf') && ps.inventory.history.length === 1 && ps.stats.purchases === 1);
    ok(`[${tag}] 중복 구매 방지(구매 버튼 → 장착 버튼)`, (await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button', { name: '장착' }).count()) === 1);
    await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button', { name: '장착' }).tap();
    ok(`[${tag}] 장착 반영`, (await player(page)).inventory.equipped.frame === 'frame_leaf');
    await page.getByRole('tab', { name: '아바타 장식' }).tap();
    await page.locator('.p-shop-item', { hasText: '새싹' }).getByRole('button').tap();
    await page.getByRole('button', { name: '구매', exact: true }).tap();
    await page.waitForTimeout(300);
    await page.locator('.p-shop-item', { hasText: '새싹' }).getByRole('button', { name: '장착' }).tap();
    await page.getByRole('tab', { name: '프로필 배경' }).tap();
    await page.locator('.p-shop-item', { hasText: '풀밭 배경' }).getByRole('button').tap();
    await page.getByRole('button', { name: '구매', exact: true }).tap();
    await page.waitForTimeout(300);
    await page.locator('.p-shop-item', { hasText: '풀밭 배경' }).getByRole('button', { name: '장착' }).tap();
    await page.getByRole('tab', { name: '프로필 테두리' }).tap();
    await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button', { name: '장착 해제' }).tap();
    ok(`[${tag}] 장착 해제 → 기본으로`, (await player(page)).inventory.equipped.frame === 'frame_basic' && (await player(page)).inventory.owned.includes('frame_leaf'));
    await page.locator('.p-shop-item', { hasText: '잎사귀 테두리' }).getByRole('button', { name: '장착' }).tap();
    ok(`[${tag}] 가로 스크롤 없음 (상점)`, await noH(page));
    await page.getByRole('button', { name: /PROFILE/ }).tap();
    await page.waitForSelector('.p-pcard');
    ok(`[${tag}] 프로필에 꾸미기 반영(테두리·배경·장식)`, (await page.locator('.p-portrait.sh-frame-leaf').count()) === 1 && (await page.locator('.p-pcard.sh-background-grass').count()) === 1 && (await page.locator('.p-pcard .p-deco').count()) === 1);
    await shot(page, w, h, '16-profile-cosmetics');

    // ── 랭킹 (로컬)
    await page.getByRole('button', { name: /RANKING/ }).tap();
    await page.waitForSelector('.p-tabs');
    const rk = await page.locator('.p-screen').innerText();
    ok(`[${tag}] 랭킹: 내 최고 기록 표시 · 가짜 순위 없음`, rk.includes('21,000') && rk.includes('온라인 랭킹 준비 중') && !/\b1위|2위|3위/.test(rk));
    await page.getByRole('tab', { name: /역대/ }).tap();
    await page.getByRole('tab', { name: '종합' }).tap();
    ok(`[${tag}] 종합 지수(정규화, 순위 아님)`, (await page.locator('.p-screen').innerText()).includes('종합 지수'));
    await page.getByRole('tab', { name: 'Sky' }).tap();
    ok(`[${tag}] 미출시 게임 COMING SOON`, await page.locator('text=COMING SOON').count());
    await page.getByRole('tab', { name: 'Food' }).tap();
    await shot(page, w, h, '17-ranking');

    // ── 설정
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.waitForSelector('text=데이터 백업');
    await page.getByRole('switch', { name: '모션 줄이기' }).tap();
    ok(`[${tag}] 모션 줄이기 → 문서 반영 · 저장`, (await page.evaluate(() => document.documentElement.dataset.reduceMotion)) === '1' && (await player(page)).settings.reduceMotion === true);
    await shot(page, w, h, '18-settings');
    ok(`[${tag}] 가로 스크롤 없음 (설정)`, await noH(page));
    // 백업 → 복원 (v2 전체 구조)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '파일로 백업' }).tap()]);
    const bp = path.join(out, `backup_${tag}.json`); await dl.saveAs(bp);
    const backup = JSON.parse(fs.readFileSync(bp, 'utf8'));
    const live = await player(page);
    ok(`[${tag}] v2 백업에 기록·구매·업적 포함`, backup.player.schemaVersion === 2 && backup.player.gameRecords['food-island'].bestScore === 21000 && backup.player.inventory.owned.includes('frame_leaf') && !!backup.player.achievements.first_clear);
    // v1 백업 호환
    const v1 = { kind: 'gona-game-paradise/player-backup', schemaVersion: 1, exportedAt: new Date().toISOString(), player: { schemaVersion: 1, playerId: '99999999-2222-4333-8444-555555555555', nickname: '옛날백업', publicCode: 'Z9Z9', avatarId: 'dad', createdAt: '2026-11-13T00:00:00.000Z', lastPlayedAt: '2026-11-13T00:00:00.000Z', playerLevel: 1, totalXP: 0, coinBalance: 5, settings: { bgm: true }, gameRecords: {}, achievements: [], unlockedAvatarIds: [] } };
    fs.writeFileSync(path.join(out, 'v1.json'), JSON.stringify(v1));
    await page.locator('input[type=file]').setInputFiles(path.join(out, 'v1.json'));
    await page.waitForSelector('text=백업으로 덮어쓸까요?');
    await page.getByRole('button', { name: '덮어쓰기' }).tap();
    await page.waitForTimeout(400);
    const pv1 = await player(page);
    ok(`[${tag}] v1 백업 복원 → v2 로 변환`, pv1.schemaVersion === 2 && pv1.nickname === '옛날백업' && pv1.coinBalance === 5 && pv1.titleId === 'rookie');
    await page.locator('input[type=file]').setInputFiles(bp);
    await page.getByRole('button', { name: '덮어쓰기' }).tap();
    await page.waitForTimeout(400);
    const back = await player(page);
    ok(`[${tag}] v2 백업 복원 → 기록·구매·칭호 동일`, JSON.stringify(back.gameRecords) === JSON.stringify(live.gameRecords) && back.inventory.owned.join() === live.inventory.owned.join() && back.titleId === live.titleId && back.coinBalance === live.coinBalance);
    await drain(page);

    // ── 다른 플레이어 세션 / 이상 점수 / 형식 오류
    const cnt = (await player(page)).gameRecords['food-island'].plays;
    await inject(page, { score: 99999999 });
    await inject(page, { playerId: 'other-player-id-000' });
    await inject(page, { noSession: true });
    await page.evaluate(() => { localStorage.setItem('gp.v1.inbox.broken-json-xx', '{oops'); window.dispatchEvent(new Event('pageshow')); });
    await page.waitForTimeout(500);
    ok(`[${tag}] 이상 점수·다른 플레이어·세션 없음·깨진 JSON → 반영 안 함, inbox 정리`, (await player(page)).gameRecords['food-island'].plays === cnt && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.inbox.')))) && (await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('gp.v1.rejected.')).length)) >= 3);

    // ── 저장 공간 부족: 저장 실패 시 결과 보관 → 복구 후 다시 시도
    await page.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === 'gp.v1.player' && window.__block) throw new DOMException('quota', 'QuotaExceededError'); return window.__origSet.call(this, k, v); }; window.__block = true; });
    await inject(page, { score: 777, stage: 1 });
    await page.waitForSelector('text=저장 실패');
    ok(`[${tag}] 저장 공간 부족: 저장 실패 화면 + 결과는 inbox 에 보관`, (await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.inbox.')))) && (await player(page)).gameRecords['food-island'].plays === cnt);
    await shot(page, w, h, '19-save-failed');
    await page.evaluate(() => { window.__block = false; });
    await page.getByRole('button', { name: '다시 시도' }).tap();
    await page.waitForTimeout(600);
    await drain(page);
    ok(`[${tag}] 다시 시도 → 한 번만 반영`, (await player(page)).gameRecords['food-island'].plays === cnt + 1 && !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.inbox.')))));
    await page.getByRole('button', { name: '월드맵으로' }).tap().catch(() => {});

    // ── 뒤로가기: 결과 화면 → 닫힘
    await inject(page, { score: 100, stage: 1 });
    await page.waitForSelector('text=RESULT');
    await page.goBack();
    await page.waitForTimeout(400);
    ok(`[${tag}] 뒤로가기: 결과 화면 닫힘(앱 유지)`, (await page.locator('text=RESULT').count()) === 0 && (await page.locator('.hit').count()) > 0);
    await drain(page);

    // ── 초기화: 세션/inbox 포함, 다른 키 보존
    await page.evaluate(() => { localStorage.setItem('dino-snack-adventure.best', '777'); });
    await page.getByRole('button', { name: /MORE/ }).tap();
    await page.getByRole('button', { name: /설정/ }).tap();
    await page.getByRole('button', { name: '초기화', exact: true }).tap();
    await page.getByRole('button', { name: '계속' }).tap();
    await page.getByRole('button', { name: '모두 삭제' }).tap();
    await page.waitForSelector('text=NEW PLAYER');
    ok(`[${tag}] 초기화: gp.v1.* 전부 삭제 · Food/기존 키 보존`, !(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('gp.v1.')))) && (await ls(page, 'dino-snack-adventure.best')) === '777' && (await ls(page, 'gona.openingSeen')) === '1');
    ok(`[${tag}] 전체 흐름 콘솔 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await ctx.close();

    // ── 두 탭 동시 처리
    {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      await c2.addInitScript(() => { try { localStorage.setItem('gona.openingSeen', '1'); } catch (e) {} });
      const A = await mkPage(browser, w, h, c2);
      await A.page.goto(url);
      await register(A.page, w, h);
      const B = await mkPage(browser, w, h, c2);
      await B.page.goto(url); await tapTitle(B.page, w, h); await B.page.waitForSelector('.hit');
      const base = (await player(A.page)).gameRecords['food-island']?.plays ?? 0;
      await A.page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem('gp.v1.player')); const now = Date.now(); const sid = 'sess-twotab00001';
        localStorage.setItem('gp.v1.session.' + sid, JSON.stringify({ version: 1, sessionId: sid, gameId: 'food-island', playerId: p.playerId, startedAt: new Date(now - 900000).toISOString(), expiresAt: new Date(now + 43200000).toISOString(), returnUrl: location.href }));
        const rid = 'rid-twotab0001';
        localStorage.setItem('gp.v1.inbox.' + rid, JSON.stringify({ kind: 'gp-result', v: 1, result: { resultId: rid, sessionId: sid, gameId: 'food-island', gameVersion: '1', scoreSchemaVersion: 1, outcome: 'failed', score: 3000, stage: 2, startedAt: new Date(now - 100000).toISOString(), endedAt: new Date(now - 1000).toISOString(), durationMs: 90000 } }));
      });
      await Promise.all([A.page.evaluate(() => window.dispatchEvent(new Event('pageshow'))), B.page.evaluate(() => window.dispatchEvent(new Event('pageshow')))]);
      await A.page.waitForTimeout(800); await B.page.waitForTimeout(800);
      const pa = await player(A.page);
      ok(`[${tag}] 두 탭 동시 수신 → 한 번만 반영(plays +1, 보상 1회)`, pa.gameRecords['food-island'].plays === base + 1 && pa.resultLedger.filter((x) => x === 'rid-twotab0001').length === 1);
      ok(`[${tag}] 두 탭 콘솔 오류 없음`, A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].join(' / '));
      await c2.close();
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  fs.writeFileSync(path.join(out, 'e2e-full-result.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
